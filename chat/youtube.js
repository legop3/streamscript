import { LiveChat } from 'youtube-chat'
import { BaseChatHandler } from './base.js'

/**
 * YouTube chat handler for live streams and shorts
 * Uses youtube-chat library for real-time chat monitoring
 */
export class YouTubeChatHandler extends BaseChatHandler {
  constructor(config = {}) {
    super(config)
    this.platform = 'youtube'
    this.liveChat = null
    this.currentLiveId = null
    
    // Configuration with defaults
    this.config = {
      channelId: config.channelId || null,
      ...config
    }
    console.log(this.config.channelId)
    
    if (!this.config.channelId) {
      console.warn('YouTube channel ID not provided. Pass channelId in config.')
    }
  }
  
  async connect() {
    try {
      console.log('Connecting to YouTube chat...')
      
      if (!this.config.channelId) {
        throw new Error('No channelId provided. Channel ID is required to connect to YouTube chat.')
      }
      
      // Initialize LiveChat
      this.liveChat = new LiveChat({ channelId: this.config.channelId })
      
      // Set up event listeners
      this.setupEventListeners()
      
      // Start the live chat monitoring
      const ok = await this.liveChat.start()
      if (!ok) {
        throw new Error('Failed to start YouTube live chat monitoring')
      }
      
    } catch (error) {
      console.error('Error connecting to YouTube chat:', error)
      throw error
    }
  }
  
  async disconnect() {
    if (this.liveChat) {
      try {
        await this.liveChat.stop()
        this.liveChat = null
        this.currentLiveId = null
        this.emitDisconnected()
      } catch (error) {
        console.error('Error disconnecting from YouTube chat:', error)
        throw error
      }
    }
  }
  
  /**
   * Set up event listeners for the LiveChat instance
   */
  setupEventListeners() {
    // Emit at start of observation chat
    this.liveChat.on('start', (liveId) => {
      console.log(`YouTube live chat started for live ID: ${liveId}`)
      this.currentLiveId = liveId
      this.emitConnected()
    })
    
    // Emit at end of observation chat
    this.liveChat.on('end', (reason) => {
      console.log(`YouTube live chat ended. Reason: ${reason || 'Unknown'}`)
      this.currentLiveId = null
      this.emitDisconnected()
    })
    
    // Emit at receive chat
    this.liveChat.on('chat', (chatItem) => {
      this.processChatItem(chatItem)
    })
    
    // Emit when an error occurs
    this.liveChat.on('error', (err) => {
      console.error('YouTube chat error:', err)
      // Optionally emit an error event for the main bot to handle
      this.emit('error', { platform: this.platform, error: err })
    })
  }
  
  /**
   * Process a chat item from YouTube Live Chat
   */
  processChatItem(chatItem) {
    try {
      // Extract basic information
      const username = chatItem.author?.name || 'Unknown'
      
      // Convert message array to string
      let message = ''
      if (chatItem.message && Array.isArray(chatItem.message)) {
        message = chatItem.message
          .map(item => item.text || '')
          .join('')
          .trim()
      }
      
      // Skip empty messages
      if (!message) {
        return
      }
      
      // Build user info object
      const userInfo = {
        id: chatItem.id,
        userId: chatItem.author?.channelId,
        username: chatItem.author?.name,
        displayName: chatItem.author?.name,
        thumbnail: chatItem.author?.thumbnail?.url,
        thumbnailAlt: chatItem.author?.thumbnail?.alt,
        channelId: chatItem.author?.channelId,
        isMembership: chatItem.isMembership || false,
        isOwner: chatItem.isOwner || false,
        isVerified: chatItem.isVerified || false,
        isModerator: chatItem.isModerator || false,
        timestamp: chatItem.timestamp,
        rawChatItem: chatItem // Keep original for advanced processing
      }
      
      // Handle special message types
      if (chatItem.isMembership) {
        message = `[MEMBERSHIP] ${message}`
      }
      
      // Use the base class method to handle the message
      this.handleMessage(message, username, userInfo)
      
    } catch (error) {
      console.error('Error processing YouTube chat item:', error)
    }
  }
  
  /**
   * Send a message to YouTube chat (not supported by youtube-chat library)
   */
  async sendMessage(message) {
    console.log('Sending messages to YouTube chat is not supported by the youtube-chat library')
    return false
  }
  
  /**
   * Get current stream information
   */
  getStreamInfo() {
    return {
      channelId: this.config.channelId,
      currentLiveId: this.currentLiveId,
      connected: this.isConnected
    }
  }
  
  /**
   * Update channel ID and reconnect
   */
  async updateChannelId(channelId) {
    const wasConnected = this.isConnected
    
    if (wasConnected) {
      await this.disconnect()
    }
    
    this.config.channelId = channelId
    this.currentLiveId = null
    
    if (wasConnected) {
      await this.connect()
    }
  }
}