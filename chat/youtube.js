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
    
    // Reconnection configuration
    this.reconnectAttempts = 0
    this.reconnectDelay = config.reconnectDelay || 10000 // 10 seconds constant rate
    this.isReconnecting = false
    this.shouldReconnect = true
    this.reconnectTimer = null
    
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
      
      // Clear any existing reconnect timer
      this.clearReconnectTimer()
      
      // Initialize LiveChat
      this.liveChat = new LiveChat({ channelId: this.config.channelId })
      
      // Set up event listeners
      this.setupEventListeners()
      
      // Start the live chat monitoring
      const ok = await this.liveChat.start()
      if (!ok) {
        throw new Error('Failed to start YouTube live chat monitoring')
      }
      
      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0
      this.isReconnecting = false
      
    } catch (error) {
      console.error('Error connecting to YouTube chat:', error)
      this.handleConnectionError(error)
      throw error
    }
  }
  
  async disconnect() {
    console.log('Disconnecting from YouTube chat...')
    
    // Stop reconnection attempts
    this.shouldReconnect = false
    this.clearReconnectTimer()
    
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
   * Handle connection errors and attempt reconnection
   */
  handleConnectionError(error) {
    if (!this.shouldReconnect) {
      console.log('Reconnection disabled, not attempting to reconnect')
      return
    }
    
    if (this.isReconnecting) {
      console.log('Already attempting to reconnect, skipping...')
      return
    }
    
    this.isReconnecting = true
    this.reconnectAttempts++
    
    console.log(`Attempting to reconnect to YouTube chat (attempt ${this.reconnectAttempts}) in ${this.reconnectDelay}ms...`)
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        // Clean up existing connection
        if (this.liveChat) {
          try {
            await this.liveChat.stop()
          } catch (stopError) {
            console.warn('Error stopping existing connection during reconnect:', stopError)
          }
          this.liveChat = null
        }
        
        // Attempt to reconnect
        await this.connect()
        console.log(`Successfully reconnected to YouTube chat (attempt ${this.reconnectAttempts})`)
        
      } catch (reconnectError) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, reconnectError)
        this.handleConnectionError(reconnectError)
      }
    }, this.reconnectDelay)
  }
  
  /**
   * Clear the reconnection timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
  
  /**
   * Enable reconnection attempts
   */
  enableReconnect() {
    this.shouldReconnect = true
    console.log('Reconnection enabled')
  }
  
  /**
   * Disable reconnection attempts
   */
  disableReconnect() {
    this.shouldReconnect = false
    this.clearReconnectTimer()
    console.log('Reconnection disabled')
  }
  
  /**
   * Reset reconnection state
   */
  resetReconnectionState() {
    this.reconnectAttempts = 0
    this.isReconnecting = false
    this.clearReconnectTimer()
    console.log('Reconnection state reset')
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
      
      // Attempt to reconnect if the stream ended unexpectedly
      if (this.shouldReconnect && reason !== 'manual') {
        console.log('Stream ended unexpectedly, attempting to reconnect...')
        this.handleConnectionError(new Error(`Stream ended: ${reason}`))
      }
    })
    
    // Emit at receive chat
    this.liveChat.on('chat', (chatItem) => {
      this.processChatItem(chatItem)
    })
    
    // Emit when an error occurs
    this.liveChat.on('error', (err) => {
      console.error('YouTube chat error:', err)
      
      // Don't emit unhandled errors, handle them gracefully
      this.emit('chatError', { platform: this.platform, error: err })
      
      // Attempt to reconnect on error
      this.handleConnectionError(err)
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
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
      shouldReconnect: this.shouldReconnect
    }
  }
  
  /**
   * Get reconnection status
   */
  getReconnectionStatus() {
    return {
      attempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting,
      shouldReconnect: this.shouldReconnect,
      hasReconnectTimer: !!this.reconnectTimer,
      reconnectDelay: this.reconnectDelay
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
    this.resetReconnectionState()
    
    if (wasConnected) {
      this.shouldReconnect = true
      await this.connect()
    }
  }
  
  /**
   * Manually trigger a reconnection attempt
   */
  async manualReconnect() {
    console.log('Manual reconnection triggered')
    this.resetReconnectionState()
    this.shouldReconnect = true
    
    try {
      if (this.liveChat) {
        await this.disconnect()
      }
      await this.connect()
    } catch (error) {
      console.error('Manual reconnection failed:', error)
      throw error
    }
  }
}