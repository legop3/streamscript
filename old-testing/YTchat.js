import { LiveChat } from "youtube-chat"
const liveChat = new LiveChat({channelId: "UC1aJDBNkUfGT2W2-VeNQT5A"})

const ok = await liveChat.start()
if (!ok) {
  console.log("Failed to start, check emitted error")
}

// Emit at start of observation chat.
// liveId: string
liveChat.on("start", (liveId) => {
/* Your code here! */
})

// Emit at end of observation chat.
// reason: string?
liveChat.on("end", (reason) => {
/* Your code here! */
})

// Emit at receive chat.
// chat: ChatItem
liveChat.on("chat", (chatItem) => {
/* Your code here! */
    console.log(chatItem)
})

// Emit when an error occurs
// err: Error or any
liveChat.on("error", (err) => {
/* Your code here! */
})