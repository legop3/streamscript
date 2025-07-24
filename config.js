// config.js - Configuration file example
export const chatConfig = {
    twitch: {
      enabled: true,
      channels: ['carpetfuzz'], // Add multiple channels
      // Optional: Add bot credentials to send messages
      // identity: {
      //   username: 'your_bot_username',
      //   password: 'oauth:your_oauth_token'
      // }
    },
    
    youtube: {
      enabled: true,
      channelId: 'UC1aJDBNkUfGT2W2-VeNQT5A', // YouTube channel ID to monitor
      // No API key needed with youtube-chat library!
    },
    
    discord: {
      enabled: false, // Set to true to enable Discord
      token: process.env.DISCORD_BOT_TOKEN,
      channelIds: ['channel_id_1', 'channel_id_2'], // Specific channels to monitor
      guildId: 'your_guild_id' // Optional: specific server
    }
  }
  
  // Environment variables you'll need to set:
  // DISCORD_BOT_TOKEN=your_discord_bot_token (only if using Discord)
  
  export const botConfig = {
    ollama: {
      server: 'http://192.168.0.22:11434',
      model: 'hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M'
    },
    
    narration: {
      interval: 30000, // 30 seconds between narrations
      chatCooldown: 5000, // 5 seconds cooldown after chat messages
      temperature: {
        narration: 1.2,
        chat: 1.0
      }
    },
    
    conversation: {
      maxLength: 20,
      cleanupThreshold: 24,
      minMessagesToKeep: 10
    },
    
    output: {
      folder: 'outputs',
      file: 'out.txt'
    }
  }