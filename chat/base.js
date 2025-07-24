import { EventEmitter } from 'events'

/**
 * Base class for all chat handlers
 * Provides common functionality and interface that all chat platforms must implement
 */
export class BaseChatHandler extends EventEmitter {
  constructor(config = {}) {
    super()
    this.config = config
    this.isConnected = false
    this.platform = 'unknown'
  }
  
  /**
   * Connect to the chat platform
   * Must be implemented by subclasses
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass')
  }
  
  /**
   * Disconnect from the chat platform
   * Must be implemented by subclasses
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass')
  }
  
  /**
   * Send a message to the chat (optional, not all platforms support this)
   * Can be overridden by subclasses
   */
  async sendMessage(message) {
    console.log(`Sending message not supported for ${this.platform}`)
  }
  
  /**
   * Parse a message to check for commands
   * Commands start with ! and are followed by arguments
   */
  parseCommand(message) {
    if (!message.startsWith('-')) {
      return null
    }
    
    const parts = message.slice(1).split(' ')
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)
    
    return { command, args }
  }
  
  /**
   * Handle incoming message - common processing for all platforms
   */
  handleMessage(message, username, userInfo = {}) {
    // Check for commands
    const commandData = this.parseCommand(message)
    
    if (commandData) {
      this.emit('command', {
        command: commandData.command,
        args: commandData.args,
        username,
        platform: this.platform,
        userInfo
      })
    } else {
      // Regular message
      this.emit('message', {
        message,
        username,
        platform: this.platform,
        userInfo
      })
    }
  }
  
  /**
   * Emit connection event
   */
  emitConnected() {
    this.isConnected = true
    this.emit('connected', this.platform)
  }
  
  /**
   * Emit disconnection event
   */
  emitDisconnected() {
    this.isConnected = false
    this.emit('disconnected', this.platform)
  }
  
  /**
   * Get platform status
   */
  getStatus() {
    return {
      platform: this.platform,
      connected: this.isConnected,
      config: this.config
    }
  }
}