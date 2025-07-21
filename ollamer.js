import { Ollama } from 'ollama'
import fs from 'fs'
import tmi from 'tmi.js'
// import { OBSWebSocket, EventSubscription } from 'obs-websocket-js'
// import config from './sceneConfig.json' assert { type: 'json'}

const olserver = 'http://192.168.0.22:11434'
const outfile = 'out.txt'
const systemPrompt = await fs.readFileSync('system.txt', 'utf8')
const ollama = new Ollama({host: olserver})
const obs = new OBSWebSocket();

// Configuration for narration timing
const NARRATION_INTERVAL = 30000 // 30 seconds between narrations
const CHAT_COOLDOWN = 5000 // 5 seconds cooldown after chat messages



await obs.connect()

class StreamNarrator {
  constructor(systemPrompt) {
    this.systemPrompt = systemPrompt
    this.messages = [{role: 'system', content: systemPrompt}]
    this.isGenerating = false
    this.lastChatMessage = null
    this.lastChatTime = 0
    this.recentChatMessages = []
    this.narrationTimer = null
  }
  
  async generateResponse(prompt, isNarration = false) {
    if (this.isGenerating) {
      console.log('Already generating, skipping...')
      return
    }
    
    this.isGenerating = true
    let printout = ''
    // fs.writeFileSync(outfile, printout)
    
    // Add user message to conversation
    this.messages.push({role: 'user', content: prompt})
    
    try {
      const response = await ollama.chat({
        model: 'hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M',
        system: this.systemPrompt,
        messages: this.messages,
        tools: tools,
        stream: true,
        options: {
          temperature: isNarration ? 1.2 : 1.0, // Higher creativity for narration
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1,
          num_ctx: 2048,
          num_predict: -1,
        },
        keep_alive: -1
      })
      
      let assistantResponse = ''
      for await (const part of response) {
        process.stdout.write(part.message.content)
        if (part.message.tool_calls) {
          console.log(part.message.tool_calls[0].function.arguments)
        }
        printout += part.message.content
        assistantResponse += part.message.content
        fs.writeFileSync(outfile, printout)
      }
      
      // Add assistant response to conversation
      this.messages.push({role: 'assistant', content: assistantResponse})
      
      // Clean up response and write to file
      assistantResponse = assistantResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      fs.writeFileSync(outfile, assistantResponse)
      
      return assistantResponse
    } catch (error) {
      console.error('Error generating response:', error)
    } finally {
      this.isGenerating = false
    }
  }
  
  startNarration() {
    console.log('Starting continuous narration...')
    this.scheduleNextNarration()
  }
  
  scheduleNextNarration() {
    // Clear existing timer
    if (this.narrationTimer) {
      clearTimeout(this.narrationTimer)
    }
    
    this.narrationTimer = setTimeout(async () => {
      await this.performNarration()
      this.scheduleNextNarration() // Schedule next narration
    }, NARRATION_INTERVAL)
  }
  
  async performNarration() {
    // Don't narrate if we just responded to chat
    const timeSinceLastChat = Date.now() - this.lastChatTime
    if (timeSinceLastChat < CHAT_COOLDOWN) {
      console.log('Skipping narration due to recent chat activity')
      return
    }
    
    // Create narration prompt based on recent chat activity
    let narrationPrompt = "Continue narrating the stream. "
    
    if (this.recentChatMessages.length > 0) {
      narrationPrompt += `Recent chat activity: ${this.recentChatMessages.join(', ')}. `
      // Keep only last 5 messages
      this.recentChatMessages = this.recentChatMessages.slice(-5)
    } else {
      narrationPrompt += "The chat has been quiet. "
    }
    
    // narrationPrompt += "Imagine what might be happening on stream and provide engaging commentary."\

    console.log('narraration prompt', narrationPrompt)
    
    console.log('\n--- PERFORMING NARRATION ---')
    await this.generateResponse(narrationPrompt, true)
  }
  
  async handleChatMessage(message, username) {
    console.log(`\n--- CHAT MESSAGE FROM ${username}: ${message} ---`)
    
    // Update chat tracking
    this.lastChatTime = Date.now()
    this.recentChatMessages.push(`${username}: ${message}`)
    
    // Reset narration timer since we're responding to chat
    this.scheduleNextNarration()
    
    // Generate response to chat
    const chatPrompt = `${username} in chat said: "${message}". Respond appropriately while staying in character as a stream narrator.`
    await this.generateResponse(chatPrompt, false)
  }
  
  clearConversation() {
    this.messages = [{role: 'system', content: this.systemPrompt}]
    this.recentChatMessages = []
    console.log('Conversation cleared')
  }
  
  getConversation() {
    return this.messages
  }
  
  // Cleanup method
  stop() {
    if (this.narrationTimer) {
      clearTimeout(this.narrationTimer)
      this.narrationTimer = null
    }
    console.log('Stream narrator stopped')
  }
}

// Initialize the narrator
const narrator = new StreamNarrator(systemPrompt)

// Set up Twitch chat client
const client = new tmi.Client({
  channels: ['carpetfuzz']
})

client.connect()

client.on('message', async (channel, tags, message, self) => {
  if (self) return
  
  const username = tags.username || 'Anonymous'
  
  // Handle special commands
  if (message.toLowerCase().startsWith('!clear')) {
    narrator.clearConversation()
    return
  }
  
  if (message.toLowerCase().startsWith('!stop')) {
    narrator.stop()
    console.log('Narration stopped by chat command')
    return
  }
  
  if (message.toLowerCase().startsWith('!start')) {
    narrator.startNarration()
    console.log('Narration started by chat command')
    return
  }
  
  // Handle regular chat messages
  await narrator.handleChatMessage(message, username)
})

client.on('connected', () => {
  console.log('Connected to Twitch chat')
  // Start the continuous narration
  narrator.startNarration()
})

client.on('disconnected', () => {
  console.log('Disconnected from Twitch chat')
  narrator.stop()
})

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  narrator.stop()
  client.disconnect()
  obs.disconnect()
  process.exit(0)
})

console.log('Stream Narrator Bot starting...')