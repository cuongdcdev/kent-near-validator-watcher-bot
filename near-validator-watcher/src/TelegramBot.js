import TelegramBot from 'node-telegram-bot-api';
import { parse } from 'csv-parse';
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { main } from '../cron.js';

const readFile = promisify(fs.readFile);
const __dirname = path.resolve();
const DATA_FOLDER = path.join(__dirname, 'data');
const CSV_FILE_PATH = path.join(DATA_FOLDER, 'chat_pool_ids.csv');

export class TelegramBotWrapper {
  constructor(API_KEY) {
    this.bot = new TelegramBot(API_KEY, { polling: true });
    this.setupListeners();
  }

  setupListeners() {
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text.trim();
      const [command, poolId] = text.split(' ');
      switch (command.toLowerCase()) {
        case '/add':
          if (poolId) {
            //validate, only validators end with poolv1.near, example: build.poolv1.near
            const poolIdSplit = poolId.split('.');
            if (poolIdSplit.length !== 3 || poolIdSplit[2] !== 'near') {
              this.sendMessage(chatId, 'Please provide a valid validator ID, example: `buildnear.poolv1.near` .');
              return;
            }
            const poolIds = await this.getPoolIdsForChatId(chatId);
            await this.saveChatIdAndPoolId(chatId, poolId);
            poolIds.push(poolId);
            const formattedList = poolIds.map((id, index) => `${index + 1}. ${id}`).join('\n');
            this.sendMessage(chatId, `✅ Added Validator ID: ${poolId} \n🔔 You are tracking the following validators:\n ${formattedList}`);
          } else {
            this.sendMessage(chatId, 'Please provide a Validator ID, example: `buildnear.poolv1.near` .');
          }
          break;
        case '/remove':
          if (poolId) {
            await this.removeChatIdAndPoolId(chatId, poolId);
            this.sendMessage(chatId, `Removed Validator ID: ${poolId}`);
          } else {
            this.sendMessage(chatId, 'Please provide a validator ID to remove.');
          }
          break;
        case '/list':
          const poolIds = await this.getPoolIdsForChatId(chatId);
          if (poolIds.length > 0) {
            const formattedList = poolIds.map((id, index) => `${index + 1}. ${id}`).join('\n');
            this.sendMessage(chatId, `You are tracking the following validators:\n ${formattedList}`);
          } else {
            this.sendMessage(chatId, 'You are not tracking any validator.');
          }
          break;
        // case '/all':
        //   const allPoolIds = await this.getAllPoolIds();
        //   if (allPoolIds.length > 0) {
        //     const formattedAllList = allPoolIds.map((id, index) => `${index + 1}. ${id}`).join('\n');
        //     this.sendMessage(chatId, `All tracked validators:\n${formattedAllList}`);
        //   } else {
        //     this.sendMessage(chatId, 'No validators are being tracked.');
        //   }
        //   break;

        case '/test':
          await this.runMainFunction(chatId);
          break;

        case '/help':
        default:
          this.sendMessage(chatId, this.getHelpMessage());
          break;
      }
    });
  }

  /**
   * Generates a help message listing all available commands for the Telegram bot.
   * The bot helps users track validator IDs by providing commands to add, remove, and list validators.
   *
   * @returns {string} A formatted string containing the help message with available commands.
   */
  getHelpMessage() {
    return `
🤖 The bot helps users monitor validators on NEAR (including stake changes, validator performance, and validator status). 
You can track multiple validators by adding their validator address.

🐔 Available commands:
- /add <validator_id>: Add a validator_id to your tracking list.
- /remove <validator_id>: Remove a validator from your tracking list.
- /list: Get all validator address that you are currently tracking.
- /help: Show this help message.

🚀 Explorer NEAR ecosystem at https://nearcatalog.xyz
    `;
  }

  async saveChatIdAndPoolId(chatId, poolId) {
    const records = await this.getChatIdsAndPoolIds();
    const chatIdStr = String(chatId);
    const userRecord = records.find(record => String(record.chat_id) === chatIdStr);
    if (userRecord) {
      if (!userRecord.pool_ids.includes(poolId)) {
        userRecord.pool_ids.push(poolId);
      }
    } else {
      records.push({ chat_id: chatIdStr, pool_ids: [poolId] });
    }
    const csvData = records.map(record => `${record.chat_id},${record.pool_ids.join('|')}`).join('\n');
    fs.writeFileSync(CSV_FILE_PATH, csvData);
  }

  async removeChatIdAndPoolId(chatId, poolId) {
    const records = await this.getChatIdsAndPoolIds();
    const chatIdStr = String(chatId);
    const userRecord = records.find(record => String(record.chat_id) === chatIdStr);
    if (userRecord) {
      userRecord.pool_ids = userRecord.pool_ids.filter(id => id !== poolId);
      if (userRecord.pool_ids.length === 0) {
        const index = records.indexOf(userRecord);
        records.splice(index, 1);
      }
    }
    const csvData = records.map(record => `${record.chat_id},${record.pool_ids.join('|')}`).join('\n');
    fs.writeFileSync(CSV_FILE_PATH, csvData);
  }

  async getChatIdsAndPoolIds() {
    if (!fs.existsSync(CSV_FILE_PATH)) {
      return [];
    }
    const fileContent = await readFile(CSV_FILE_PATH, 'utf8');
    const records = [];
    const parser = parse(fileContent, { columns: false, trim: true });
    for await (const record of parser) {
      const [chat_id, pool_ids] = record;
      records.push({ chat_id, pool_ids: pool_ids ? pool_ids.split('|') : [] });
    }
    return records;
  }

  async getPoolIdsForChatId(chatId) {
    const records = await this.getChatIdsAndPoolIds();
    const chatIdStr = String(chatId);
    const userRecord = records.find(record => String(record.chat_id) === chatIdStr);
    return userRecord ? userRecord.pool_ids : [];
  }

  async getAllPoolIds() {
    const records = await this.getChatIdsAndPoolIds();
    const allPoolIds = new Set();
    records.forEach(record => {
      record.pool_ids.forEach(poolId => allPoolIds.add(poolId));
    });
    return Array.from(allPoolIds);
  }

  async runMainFunction(chatId) {
    try {
      await main();
      this.bot.sendMessage(chatId, '/TEST: Main function executed successfully.');
    } catch (error) {
      console.error(error);
      this.bot.sendMessage(chatId, `Error executing main function: ${error.message}`);
    }
  }

  async sendMessage(chatId, message) {
    try {
      console.log("send message to chat id: " + chatId + "| type of chatid: " + typeof chatId + " | content message: " + message );
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error("error send message:", error);
    }
  }

  async sendMessageMarkdown(chatId, message) {
    try {
      console.log("send message to chat id: " + chatId + "| type of chatid: " + typeof chatId + " | content message: " + message );
      // await this.bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error("error send message:", error);
    }
  }

}
