const axios = require('axios');
const fs = require('fs');

class TelegramClient {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(text) {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('[TELEGRAM] Error sending message:', error.response?.data || error.message);
    }
  }

  async sendPhoto(photoPathOrUrl, caption) {
    try {
      // 1. If it's a URL, send directly using Telegram's URL fetch capability (no local download needed)
      if (photoPathOrUrl.startsWith('http://') || photoPathOrUrl.startsWith('https://')) {
        await axios.post(`${this.baseUrl}/sendPhoto`, {
          chat_id: this.chatId,
          photo: photoPathOrUrl,
          caption: caption,
          parse_mode: 'HTML'
        });
        return;
      }

      // 2. Otherwise, treat as local file path and send as multipart/form-data
      if (!fs.existsSync(photoPathOrUrl)) {
        throw new Error(`File does not exist: ${photoPathOrUrl}`);
      }

      const fileBuffer = fs.readFileSync(photoPathOrUrl);
      const formData = new FormData();
      const filename = photoPathOrUrl.split('/').pop() || 'image.png';
      
      formData.append('chat_id', this.chatId);
      formData.append('photo', new Blob([fileBuffer], { type: 'image/png' }), filename);
      
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }

      await axios.post(`${this.baseUrl}/sendPhoto`, formData);
    } catch (error) {
      console.error('[TELEGRAM] Error sending photo:', error.response?.data || error.message);
    }
  }
}

module.exports = TelegramClient;
