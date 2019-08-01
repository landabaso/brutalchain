const net = require('net'); //Provides the functionality to create a TCP server
const express = require('express'); //Provides the functionality to create an HTTP server

let blockchain = [
  'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'
];
const peerNodes = {};

//Message types between nodes (inspired in Bitcoin)
const MESSAGE_TYPE_INVENTORY = 'MESSAGE_TYPE_INVENTORY'; //anounce a new mined block and send the complete blockchain
const MESSAGE_TYPE_ADDR = 'MESSAGE_TYPE_ADDR'; //announce the address of a new node

const P2P_ADDR = 'localhost';
const P2P_PORT = process.env.P2P_PORT || 10001;
const HTTP_PORT = process.env.HTTP_PORT || 20001;

const ANNOUNCE_IM_ALIVE_TIME = 5 * 1000;
const DISCARD_NODE_AFTER_TIME = 10 * 1000;

//Converts string "localhost:10001" to object {address: localhost, port: 10001}
function splitSocketAddress(socketAddress) {
  const parts = socketAddress.split(':');
  const port = parseInt(parts.pop());
  const address = parts.join();
  return { address, port };
}

//Initialize the pool of seed nodes
if (typeof process.env.REMOTE_PEERS !== 'undefined') {
  const peers = process.env.REMOTE_PEERS.split(',');
  peers.map(
    peer =>
      (peerNodes[peer] = { ...splitSocketAddress(peer), timestamp: Date.now() })
  );
}

console.log(`Starting node on ${P2P_ADDR}:${P2P_PORT}`);

const nodeServer = net
  .createServer(remoteNodeSocket => {
    //This function will be called when a remote node connects to this node.
    remoteNodeSocket.on('data', rawData => {
      const data = JSON.parse(rawData.toString());

      //See what type of message the node gets:
      switch (data.type) {
        case MESSAGE_TYPE_ADDR: //This is when we a receive the P2P address of a node that is alive and is pinging the p2p network
          const peer = data.payload;

          //Check if we already have this node in our pool of connected nodes
          if (typeof peerNodes[peer] === 'undefined') {
            const splittedAddress = splitSocketAddress(peer);
            //Add this peer to my list of peers
            peerNodes[peer] = { ...splittedAddress, timestamp: Date.now() };
            //Send this peer (and others) my blockchain in case it's longer that their one
            broadcastBlockchain();
            //Announce this peer to the rest of connected peers
            announceNode(splittedAddress);
          } else {
            //Update the last time this node has been seen alive
            peerNodes[peer].timestamp = Date.now();
          }
          break;

        case MESSAGE_TYPE_INVENTORY: //This is when we get a blokchain from another node
          const candidateBlockchain = data.payload;
          if (
            //Check if the new blockhain is longer
            candidateBlockchain.length > blockchain.length &&
            //Check if they share the same genesis
            blockchain[0] === candidateBlockchain[0]
          ) {
            //Replace it
            blockchain = candidateBlockchain;
          }
          break;
      }
      remoteNodeSocket.end();
    });
  })
  .on('error', error => console.log(`[${P2P_PORT}] Connection error:`, error));

nodeServer.listen({ port: P2P_PORT });

function broadcastBlockchain() {
  for (let index in peerNodes) {
    console.log(
      `[${P2P_PORT}] Broadcasting blockchain to remote node: ${index}`
    );
    let clientNodeSocket = net
      .createConnection(peerNodes[index], () => {
        clientNodeSocket.write(
          JSON.stringify({
            type: MESSAGE_TYPE_INVENTORY,
            payload: blockchain
          })
        );
      })
      .on('error', error =>
        console.log(`[${P2P_PORT}] Connection error:`, error)
      );
  }
}

//Anounce a new node to the P2P network
function announceNode(params) {
  const { address, port } = params;
  for (let index in peerNodes) {
    //Do not announce a node to itself
    if (
      peerNodes[index].address !== address ||
      peerNodes[index].port !== port
    ) {
      let clientNodeSocket = net
        .createConnection(peerNodes[index], () => {
          clientNodeSocket.write(
            JSON.stringify({
              type: MESSAGE_TYPE_ADDR,
              payload: `${address}:${port}`
            })
          );
        })
        .on('error', error =>
          console.log(`[${P2P_PORT}] Connection error:`, error)
        );
    }
  }
}

//Announce myself
announceNode({ address: P2P_ADDR, port: P2P_PORT });
//Send my blockchain
broadcastBlockchain();

//Keep announcing myself while I'm alive
setInterval(() => {
  const now = Date.now();
  announceNode({ address: P2P_ADDR, port: P2P_PORT });
  console.log(
    `[${P2P_PORT}] List of up to date peers:`,
    Object.keys(peerNodes)
  );
  console.log(`[${P2P_PORT}] Current blockchain:`, blockchain);
}, ANNOUNCE_IM_ALIVE_TIME);

//Detect nodes that stopped pinging us and remove them
setInterval(() => {
  const now = Date.now();
  for (let index in peerNodes) {
    if (now - peerNodes[index].timestamp > DISCARD_NODE_AFTER_TIME) {
      console.log(`[${P2P_PORT}] Removing old node: ${index}`);
      delete peerNodes[index];
      console.log(
        `[${P2P_PORT}] List of up to date peers:`,
        Object.keys(peerNodes)
      );
    }
  }
}, DISCARD_NODE_AFTER_TIME / 2);

//Create a web server so that a wallet can be connected using HTTP POST messages
const app = express();
app.use(express.json());
app.post('/produceBlock', (req, res) => {
  if (typeof req.body.message !== 'undefined') {
    blockchain.push(req.body.message);
    console.log(
      `[${P2P_PORT}] Mining new block with messge:`,
      req.body.message
    );
    broadcastBlockchain();
  }
  res.send(JSON.stringify(blockchain) + "\n");
});
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
  <head><title>BrutalCoin</title><meta http-equiv="refresh" content="1"/></head>
  <body>
    <h1>BrutalCoin explorer</h1><h2>Blockchain:</h2>
    <pre>${JSON.stringify(blockchain, null, 2)}</pre>
    <i>The browser will automatically refresh with new messages when available.</i>
  </body>
</html>
    `);
});
app.listen(HTTP_PORT);
