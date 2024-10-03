import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { NodeFetcher } from './src/NodeFetcher.js';
import { countProductivity } from './src/helpers.js';
import { TelegramBotWrapper } from './src/TelegramBot.js';
import cron from 'node-cron';
const __dirname = path.resolve();
const DATA_FOLDER = path.join(__dirname, 'data');
dotenv.config({ path: './config.env' });
const { NODE_RPC, TG_API_KEY } = process.env;

const tgBot = new TelegramBotWrapper(TG_API_KEY);
const nodeFetcher = new NodeFetcher(NODE_RPC);    
const STATE_FILE = path.join(DATA_FOLDER, 'state.json');
let prevState = null;


const main = async () => {

    
    console.log("trigger run Main function in index.js")
    try {
        console.log("run Main function in index.js")
        // const node = await nodeFetcher.ping();
        // const { validator_account_id } = await node.json();

        const status = await nodeFetcher.checkValidators();
        const { result: rpcResult } = await status.json();

        const epochStartHeight = rpcResult.epoch_start_height;
        const epochHeight = rpcResult.epoch_height;

        let oldState = {};

        let newState = {
            epochStartHeight,
            epochHeight,
            validators: rpcResult.current_validators,
            productivity: rpcResult.current_validators.map(v => ({
                account_id: v.account_id,
                productivity: countProductivity(v)
            }))
        };

        if (fs.existsSync(STATE_FILE)) {
            prevState = fs.readFileSync(STATE_FILE, 'utf8');
        }
        
        // if epochHeight is the same as the previous state, then do nothing
        if (prevState) {
            oldState = JSON.parse(prevState);
        }

        //set bot states
        tgBot.setStates(oldState, newState, rpcResult);
        
        if (newState.epochStartHeight === oldState?.epochStartHeight) {
            console.log('epochStartHeight is the same, do nothing');
            return;
        }

        // rewrite new state
        console.log("Rewrite new state file!");
        fs.writeFileSync(STATE_FILE, '');
        fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2) );

        // Notify all users
        console.log("Start notify all users");
        const users = await tgBot.getChatIdsAndPoolIds();
        for (const user of users) {
            const { chat_id, pool_ids } = user;
            console.log("Notify user chatID: ", chat_id, " | pool Ids:", JSON.stringify(pool_ids));
            // await tgBot.sendMessage(chat_id, "TEST MSG: " + "Notify user chatID: ", chat_id, " | pool Ids:", JSON.stringify(pool_ids));

            for (const pool_id of pool_ids) {
               
                // const newValidatorState = newState.validators.find(v => v.account_id === pool_id);
                // const oldValidatorState = oldState?.validators.find(v => v.account_id === pool_id);
                // const validatorKickoutState = result?.prev_epoch_kickout.find(k => k.account_id === pool_id);

                // if (newValidatorState) {
                //     const chunksRatio = newValidatorState.num_produced_chunks / newValidatorState.num_expected_chunks;
                //     const blocksRatio = newValidatorState.num_produced_blocks / newValidatorState.num_expected_blocks;

                //     const trigger =
                //         chunksRatio < TRIGGER_UPTIME_NOTIFICATION_RATIO ||
                //         blocksRatio < TRIGGER_UPTIME_NOTIFICATION_RATIO;

                //     //  also notify user when a new epoch started
                //     if (newState.epochStartHeight !== oldState?.epochStartHeight) {
                //         console.log("New epoch started! Notify user ID:" + chat_id + " about pool_id: " + pool_id);
                //         const newValidatorStatMsg = prepareSwitchingEpochInfo(
                //             newState.epochHeight,
                //             oldValidatorState,
                //             newValidatorState,
                //             validatorKickoutState,
                //             pool_id
                //         );
                //         console.log(" newValidatorStatMsg: ", newValidatorStatMsg);
                //         await tgBot.sendMessageMarkdown(chat_id, newValidatorStatMsg);
                //     }

                //     //notify user if the node has produced lower than expected
                //     //expectedChunks >= 4 is condition to avoid messages if the first or second expected chunks was failed
                //     if (
                //         trigger &&
                //         newValidatorState.num_expected_chunks >= 4 &&
                //         oldState?.productivity.find(p => p.account_id === pool_id)?.productivity > newValidatorState.productivity
                //     ) {
                //         const msgRows = [
                //             '⚠ SOMETHING WRONG!',
                //             getPoolId(pool_id),
                //             'Your node has produced lower than expected',
                //             getChunksBlocksEndorsementsStat('Productivity', newValidatorState),
                //         ];
                //         await tgBot.sendMessageMarkdown(chat_id, msgRows.join('\n'));
                //     }

                // } 
                await tgBot.sendPoolStatus(chat_id, pool_id);
            }
        }
    } catch (error) {
        console.log(error);
            const adminChatId = process.env.ADMIN_CHAT_ID;
            await tgBot.sendMessage(adminChatId, '🚨 SYSTEM ERROR 🚨\n' + error.message);
    }
};
export {main}

// Run the main function immediately on startup
main();

// Schedule the main function to run every 15 minutes
cron.schedule('*/1 * * * *', main);