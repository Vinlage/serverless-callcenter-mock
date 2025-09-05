import 'dotenv/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { customAlphabet } from 'nanoid';

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const queueUrl = process.env.QUEUE_URL;

const sqs = new SQSClient({ region, endpoint, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

function fakeCall() {
  const startedAt = Date.now();
  return {
    callId: nanoid(),
    customerNumber: "+1" + Math.floor(1000000000 + Math.random() * 9000000000),
    agentId: `agent-${Math.floor(Math.random()*100)}`,
    startedAt,
    durationSec: Math.floor(Math.random() * 600),
    outcome: ["RESOLVED","ESCALATED","ABANDONED"][Math.floor(Math.random()*3)]
  };
}

async function sendOne() {
  if (!queueUrl) throw new Error('Missing QUEUE_URL');
  const body = JSON.stringify(fakeCall());
  await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: body }));
  console.log('Sent:', body);
}

const args = process.argv.slice(2);
if (args.includes('--once')) {
  sendOne();
} else if (args.includes('--burst')) {
  const n = parseInt(args[args.indexOf('--burst') + 1] || '10', 10);
  Promise.all(Array.from({ length: n }, () => sendOne())).then(() => console.log(`Burst ${n} sent`));
} else {
  // stream a call every 2s
  setInterval(sendOne, 2000);
}