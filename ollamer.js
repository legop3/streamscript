import { Ollama } from 'ollama'
import fs from 'fs'
import tmi from 'tmi.js'
// import { OBSWebSocket, EventSubscription } from 'obs-websocket-js'
// import config from './sceneConfig.json' assert { type: 'json'}
import { loadingSpinnerControl } from './obs.js'
import { tools } from './tools.js'

const outfolder = 'outputs'
const outfile = 'out.txt'
const olserver = 'http://192.168.0.22:11434'
const systemPrompt = await fs.readFileSync('system.txt', 'utf8')
const ollama = new Ollama({host: olserver})
// const obs = new OBSWebSocket();

// Configuration for narration timing
const NARRATION_INTERVAL = 30000 // 30 seconds between narrations
const CHAT_COOLDOWN = 5000 // 5 seconds cooldown after chat messages

// Configuration for conversation history management
const MAX_CONVERSATION_LENGTH = 20 // Maximum number of message pairs to keep
const CLEANUP_THRESHOLD = 24 // Clean up when we reach this many messages
const MIN_MESSAGES_TO_KEEP = 10 // Always keep at least this many recent messages

// await obs.connect()

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
  
  // New method to manage conversation history
  cleanupConversationHistory() {
    // Only cleanup if we have too many messages
    if (this.messages.length <= CLEANUP_THRESHOLD) {
      return
    }
    
    console.log(`Cleaning up conversation history. Current length: ${this.messages.length}`)
    
    // Always keep the system message (index 0)
    const systemMessage = this.messages[0]
    
    // Keep the most recent messages (skip system message, then take last N messages)
    const messagesToKeep = this.messages.slice(-MIN_MESSAGES_TO_KEEP)
    
    // Reconstruct the messages array
    this.messages = [systemMessage, ...messagesToKeep]
    
    console.log(`Conversation history cleaned. New length: ${this.messages.length}`)
  }
  
  // Alternative method: Keep only last N conversation pairs
  cleanupByPairs() {
    if (this.messages.length <= CLEANUP_THRESHOLD) {
      return
    }
    
    console.log(`Cleaning up conversation history by pairs. Current length: ${this.messages.length}`)
    
    const systemMessage = this.messages[0]
    const conversationMessages = this.messages.slice(1) // Everything except system
    
    // Group messages into pairs (user + assistant)
    const pairs = []
    for (let i = 0; i < conversationMessages.length; i += 2) {
      if (i + 1 < conversationMessages.length) {
        pairs.push([conversationMessages[i], conversationMessages[i + 1]])
      } else {
        // Handle odd number of messages
        pairs.push([conversationMessages[i]])
      }
    }
    
    // Keep only the last N pairs
    const pairsToKeep = pairs.slice(-MAX_CONVERSATION_LENGTH)
    const messagesToKeep = pairsToKeep.flat()
    
    this.messages = [systemMessage, ...messagesToKeep]
    
    console.log(`Conversation history cleaned. New length: ${this.messages.length}`)
  }
  
  // Smart cleanup that preserves important context
  smartCleanup() {
    if (this.messages.length <= CLEANUP_THRESHOLD) {
      return
    }
    
    console.log(`Smart cleanup - Current length: ${this.messages.length}`)
    
    const systemMessage = this.messages[0]
    const conversationMessages = this.messages.slice(1)
    
    // Always keep the most recent messages
    const recentMessages = conversationMessages.slice(-MIN_MESSAGES_TO_KEEP)
    
    // Try to keep some older messages that might be important
    // (e.g., messages with certain keywords, longer messages, etc.)
    const olderMessages = conversationMessages.slice(0, -MIN_MESSAGES_TO_KEEP)
    const importantOlderMessages = olderMessages.filter(msg => 
      msg.content.length > 100 || // Keep longer messages
      msg.content.toLowerCase().includes('remember') || // Keep memory-related messages
      msg.content.toLowerCase().includes('important') ||
      msg.role === 'user' // Prefer to keep user messages for context
    ).slice(-5) // Keep max 5 important older messages
    
    this.messages = [systemMessage, ...importantOlderMessages, ...recentMessages]
    
    console.log(`Smart cleanup complete. New length: ${this.messages.length}`)
  }
  
  async generateResponse(prompt, isNarration = false) {
    if (this.isGenerating) {
      console.log('Already generating, skipping...')
      return
    }
    
    this.isGenerating = true
    
    // Clean up conversation history before adding new messages
    this.cleanupConversationHistory() // or use this.smartCleanup() or this.cleanupByPairs()
    
    // Add user message to conversation
    this.messages.push({role: 'user', content: prompt})
    
    try {
      const response = await ollama.chat({
        model: 'hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M',
        // model: 'llama3.1:70b-instruct-q4_0',
        system: this.systemPrompt,
        messages: this.messages,
        tools: tools,
        options: {
          temperature: isNarration ? 1.2 : 1.0, // Higher creativity for narration
          // top_p: 0.9,
          // top_k: 40,
          // repeat_penalty: 1.1,
          // num_ctx: 2048,
          // num_predict: -1,
        },
        keep_alive: 600
      })
      
      const assistantResponse = response.message.content
      
      // Handle tool calls if present
      if (response.message.tool_calls) {
        console.log('Tool calls:', response.message.tool_calls)
      }
      
      // Add assistant response to conversation
      this.messages.push({role: 'assistant', content: assistantResponse})
      
      // Clean up response and write to file
      const cleanResponse = assistantResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      fs.writeFileSync(outfile, cleanResponse)
      
      console.log(`[History: ${this.messages.length} messages]`, assistantResponse)
      
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
    
    console.log('narration prompt:', narrationPrompt)
    
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
  
  // New method to get conversation stats
  getConversationStats() {
    return {
      totalMessages: this.messages.length,
      userMessages: this.messages.filter(m => m.role === 'user').length,
      assistantMessages: this.messages.filter(m => m.role === 'assistant').length,
      systemMessages: this.messages.filter(m => m.role === 'system').length
    }
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
    loadingSpinnerControl(true)
    return
  }
  
  if (message.toLowerCase().startsWith('!start')) {
    narrator.startNarration()
    console.log('Narration started by chat command')
    loadingSpinnerControl(false)
    return
  }
  
  // New command to check conversation stats
  if (message.toLowerCase().startsWith('!stats')) {
    const stats = narrator.getConversationStats()
    console.log('Conversation stats:', stats)
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
  // obs.disconnect()
  process.exit(0)
})

console.log('Stream Narrator Bot starting...')