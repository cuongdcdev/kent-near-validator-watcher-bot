import cron from 'node-cron';
import { main } from './index.js';

main();

// Schedule the main function to run every 15 minutes
cron.schedule('*/1 * * * *', main);