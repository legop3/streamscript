import { Ollama } from 'ollama'
import fs from 'fs'
import { loadingSpinnerControl } from './obs.js'
import { tools } from './tools.js'
import { TwitchChatHandler } from './chat/twitch.js'
import { YouTubeChatHandler } from './chat/youtube.js'

const outfolder = 'outputs'
const outfile = 'out.txt'
const olserver = 'http://192.168.0.22:11434'
const systemPrompt = await fs.readFileSync('system.txt', 'utf8')
const ollama = new Ollama({host: olserver})

// Configuration for narration timing
const NARRATION_INTERVAL = 30000 // 30 seconds between narrations
const CHAT_COOLDOWN = 5000 // 5 seconds cooldown after chat messages

// Configuration for conversation history management
const MAX_CONVERSATION_LENGTH = 20 // Maximum number of message pairs to keep
const CLEANUP_THRESHOLD = 24 // Clean up when we reach this many messages
const MIN_MESSAGES_TO_KEEP = 10 // Always keep at least this many recent messages

class StreamNarrator {
  constructor(systemPrompt) {
    this.systemPrompt = systemPrompt
    this.messages = [{role: 'system', content: systemPrompt}]
    this.isGenerating = false
    this.lastChatMessage = null
    this.lastChatTime = 0
    this.recentChatMessages = []
    this.narrationTimer = null
    this.chatHandlers = new Map()
  }
  
  // Register a chat handler
  registerChatHandler(platform, handler) {
    this.chatHandlers.set(platform, handler)
    
    // Set up event listeners for the chat handler
    handler.on('message', (data) => this.handleChatMessage(data.message, data.username, data.platform))
    handler.on('connected', (platform) => console.log(`Connected to ${platform} chat`))
    handler.on('disconnected', (platform) => console.log(`Disconnected from ${platform} chat`))
    handler.on('command', (data) => this.handleCommand(data.command, data.args, data.platform))
    
    console.log(`Registered ${platform} chat handler`)
  }
  
  // Start all chat handlers
  async startChatHandlers() {
    for (const [platform, handler] of this.chatHandlers) {
      try {
        await handler.connect()
        console.log(`${platform} chat handler started`)
      } catch (error) {
        console.error(`Failed to start ${platform} chat handler:`, error)
      }
    }
  }
  
  // Stop all chat handlers
  async stopChatHandlers() {
    for (const [platform, handler] of this.chatHandlers) {
      try {
        await handler.disconnect()
        console.log(`${platform} chat handler stopped`)
      } catch (error) {
        console.error(`Error stopping ${platform} chat handler:`, error)
      }
    }
  }
  
  // Handle commands from any platform
  async handleCommand(command, args, platform) {
    console.log(`Command received from ${platform}: ${command} ${args.join(' ')}`)
    
    switch (command) {
      case 'clear':
        this.clearConversation()
        break
      case 'stop':
        this.stop()
        console.log('Narration stopped by chat command')
        loadingSpinnerControl(true)
        break
      case 'start':
        this.startNarration()
        console.log('Narration started by chat command')
        loadingSpinnerControl(false)
        break
      case 'stats':
        const stats = this.getConversationStats()
        console.log('Conversation stats:', stats)
        break
      default:
        console.log(`Unknown command: ${command}`)
    }
  }
  
  cleanupConversationHistory() {
    if (this.messages.length <= CLEANUP_THRESHOLD) {
      return
    }
    
    console.log(`Cleaning up conversation history. Current length: ${this.messages.length}`)
    
    const systemMessage = this.messages[0]
    const messagesToKeep = this.messages.slice(-MIN_MESSAGES_TO_KEEP)
    
    this.messages = [systemMessage, ...messagesToKeep]
    
    console.log(`Conversation history cleaned. New length: ${this.messages.length}`)
  }
  
  cleanupByPairs() {
    if (this.messages.length <= CLEANUP_THRESHOLD) {
      return
    }
    
    console.log(`Cleaning up conversation history by pairs. Current length: ${this.messages.length}`)
    
    const systemMessage = this.messages[0]
    const conversationMessages = this.messages.slice(1)
    
    const pairs = []
    for (let i = 0; i < conversationMessages.length; i += 2) {
      if (i + 1 < conversationMessages.length) {
        pairs.push([conversationMessages[i], conversationMessages[i + 1]])
      } else {
        pairs.push([conversationMessages[i]])
      }
    }
    
    const pairsToKeep = pairs.slice(-MAX_CONVERSATION_LENGTH)
    const messagesToKeep = pairsToKeep.flat()
    
    this.messages = [systemMessage, ...messagesToKeep]
    
    console.log(`Conversation history cleaned. New length: ${this.messages.length}`)
  }
  
  smartCleanup() {
    if (this.messages.length <= CLEANUP_THRESHOLD) {
      return
    }
    
    console.log(`Smart cleanup - Current length: ${this.messages.length}`)
    
    const systemMessage = this.messages[0]
    const conversationMessages = this.messages.slice(1)
    
    const recentMessages = conversationMessages.slice(-MIN_MESSAGES_TO_KEEP)
    
    const olderMessages = conversationMessages.slice(0, -MIN_MESSAGES_TO_KEEP)
    const importantOlderMessages = olderMessages.filter(msg => 
      msg.content.length > 100 ||
      msg.content.toLowerCase().includes('remember') ||
      msg.content.toLowerCase().includes('important') ||
      msg.role === 'user'
    ).slice(-5)
    
    this.messages = [systemMessage, ...importantOlderMessages, ...recentMessages]
    
    console.log(`Smart cleanup complete. New length: ${this.messages.length}`)
  }
  
  async generateResponse(prompt, isNarration = false) {
    if (this.isGenerating) {
      console.log('Already generating, skipping...')
      return
    }
    
    this.isGenerating = true
    
    this.cleanupConversationHistory()
    
    this.messages.push({role: 'user', content: prompt})
    
    try {
      const response = await ollama.chat({
        model: 'hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M',
        system: this.systemPrompt,
        messages: this.messages,
        tools: tools,
        options: {
          temperature: isNarration ? 1.2 : 1.0,
        },
        keep_alive: 600
      })
      
      const assistantResponse = response.message.content
      
      if (response.message.tool_calls) {
        console.log('Tool calls:', response.message.tool_calls)
      }
      
      this.messages.push({role: 'assistant', content: assistantResponse})
      
      const cleanResponse = assistantResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      fs.writeFileSync(outfile, cleanResponse)
      
      console.log(`[History: ${this.messages.length} messages]`, assistantResponse)
    //   console.log(this.messages)
      
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
    if (this.narrationTimer) {
      clearTimeout(this.narrationTimer)
    }
    
    this.narrationTimer = setTimeout(async () => {
      await this.performNarration()
      this.scheduleNextNarration()
    }, NARRATION_INTERVAL)
  }
  
  async performNarration() {
    const timeSinceLastChat = Date.now() - this.lastChatTime
    if (timeSinceLastChat < CHAT_COOLDOWN) {
      console.log('Skipping narration due to recent chat activity')
      return
    }
    
    let narrationPrompt = "Continue narrating the stream. "
    
    if (this.recentChatMessages.length > 0) {
      narrationPrompt += `Recent chat activity: ${this.recentChatMessages.join(', ')}. `
      this.recentChatMessages = this.recentChatMessages.slice(-1)
    } else {
      narrationPrompt += "The chat has been quiet. "
    }
    
    
    console.log('\n--- PERFORMING NARRATION ---')
    console.log('\nnarration prompt:', narrationPrompt)
    console.log('recent chat messages: ', this.recentChatMessages)
    await this.generateResponse(narrationPrompt, true)
  }
  
  async handleChatMessage(message, username, platform) {
    console.log(`\n--- CHAT MESSAGE FROM ${username} (${platform.toUpperCase()}): ${message} ---`)
    
    this.lastChatTime = Date.now()
    this.recentChatMessages.push(`${username} (${platform}): ${message}`)
    
    this.scheduleNextNarration()
    
    const chatPrompt = `${username} from ${platform} chat said: "${message}". Respond appropriately while staying in character as a stream narrator.`
    await this.generateResponse(chatPrompt, false)
  }
  
  clearConversation() {
    this.messages = [{role: 'system', content: this.systemPrompt}]
    this.recentChatMessages = []
    console.log('Conversation cleared')
  }
  
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

// Configuration for chat platforms
const chatConfig = {
  twitch: {
    enabled: true,
    channels: ['carpetfuzz']
  },
  youtube: {
    enabled: true,
    channelId: 'UC1aJDBNkUfGT2W2-VeNQT5A' // Replace with your YouTube channel ID
  }
}

// Initialize chat handlers
async function initializeChatHandlers() {
  // Initialize Twitch chat if enabled
  if (chatConfig.twitch.enabled) {
    const twitchHandler = new TwitchChatHandler({
      channels: chatConfig.twitch.channels
    })
    narrator.registerChatHandler('twitch', twitchHandler)
  }
  
  // Initialize YouTube chat if enabled
  if (chatConfig.youtube.enabled) {
    const youtubeHandler = new YouTubeChatHandler({
      channelId: chatConfig.youtube.channelId
    })
    narrator.registerChatHandler('youtube', youtubeHandler)
  }
  
  // Start all chat handlers
  await narrator.startChatHandlers()
  
  // Start narration
  narrator.startNarration()
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  narrator.stop()
  await narrator.stopChatHandlers()
  process.exit(0)
})

console.log('Stream Narrator Bot starting...')
initializeChatHandlers().catch(console.error)