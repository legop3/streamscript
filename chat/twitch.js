import tmi from 'tmi.js'
import { BaseChatHandler } from './base.js'

/**
 * Twitch chat handler using tmi.js
 */
export class TwitchChatHandler extends BaseChatHandler {
  constructor(config = {}) {
    super(config)
    this.platform = 'twitch'
    this.client = null
    
    // Default configuration
    this.config = {
      channels: ['carpetfuzz'],
      ...config
    }
  }
  
  async connect() {
    try {
      // Initialize TMI client
      this.client = new tmi.Client({
        channels: this.config.channels,
        options: {
          debug: false,
          messagesLogLevel: 'info'
        },
        connection: {
          reconnect: true,
          secure: true
        },
        // Add identity if you want to send messages
        // identity: {
        //   username: 'your_bot_username',
        //   password: 'oauth:your_oauth_token'
        // }
      })
      
      // Set up event listeners
      this.client.on('connected', (addr, port) => {
        console.log(`Connected to Twitch IRC at ${addr}:${port}`)
        this.emitConnected()
      })
      
      this.client.on('disconnected', (reason) => {
        console.log(`Disconnected from Twitch IRC: ${reason}`)
        this.emitDisconnected()
      })
      
      this.client.on('message', (channel, tags, message, self) => {
        // Ignore messages from the bot itself
        if (self) return
        
        const username = tags.username || 'Anonymous'
        const userInfo = {
          userId: tags['user-id'],
          displayName: tags['display-name'],
          color: tags.color,
          badges: tags.badges,
          mod: tags.mod,
          subscriber: tags.subscriber,
          turbo: tags.turbo,
          emotes: tags.emotes,
          channel: channel.slice(1) // Remove the # prefix
        }
        
        // Use the base class method to handle the message
        this.handleMessage(message, username, userInfo)
      })
      
      this.client.on('join', (channel, username, self) => {
        if (!self) {
          console.log(`${username} joined ${channel}`)
        }
      })
      
      this.client.on('part', (channel, username, self) => {
        if (!self) {
          console.log(`${username} left ${channel}`)
        }
      })
      
      // Connect to Twitch
      await this.client.connect()
      
    } catch (error) {
      console.error('Error connecting to Twitch:', error)
      throw error
    }
  }
  
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect()
        this.client = null
      } catch (error) {
        console.error('Error disconnecting from Twitch:', error)
        throw error
      }
    }
  }
  
  /**
   * Send a message to a Twitch channel
   * Requires bot to be authenticated with proper credentials
   */
  async sendMessage(message, channel = null) {
    if (!this.client || !this.isConnected) {
      console.log('Not connected to Twitch')
      return false
    }
    
    try {
      // If no channel specified, use the first configured channel
      const targetChannel = channel || this.config.channels[0]
      await this.client.say(targetChannel, message)
      console.log(`Sent message to #${targetChannel}: ${message}`)
      return true
    } catch (error) {
      console.error('Error sending message to Twitch:', error)
      return false
    }
  }
  
  /**
   * Get information about connected channels
   */
  getChannelInfo() {
    if (!this.client) {
      return null
    }
    
    return {
      channels: this.config.channels,
      connected: this.isConnected
    }
  }
}