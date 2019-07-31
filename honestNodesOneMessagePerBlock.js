const net = require('net'); //Provides the functionality to create a TCP server
const express = require('express');

let blockchain = [
  'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'
];

//Message types between nodes (inspited on Bitcoin)
const MESSAGE_TYPE_INVENTORY = 'MESSAGE_TYPE_INVENTORY'; //used to anounce a new mined block and send the complete blockchain
const MESSAGE_TYPE_ADDR = 'MESSAGE_TYPE_ADDR'; //used to announce a new address
const MESSAGE_TYPE_GETADDR = 'MESSAGE_TYPE_GETADDR'; //used to get online nodes addresses

const P2P_ADDR = 'localhost';
const P2P_PORT = process.env.P2P_PORT || 10001;
const HTTP_PORT = process.env.HTTP_PORT || 20001;

const peerNodes = {};
const ANNOUNCE_IM_ALIVE_TIME = 5 * 1000;
const DISCARD_NODE_AFTER_TIME = 10 * 1000;

//Converts string localhost:10001 to object {address: localhost, port: 10001}
function splitSocketAddress(socketAddress) {
  const parts = socketAddress.split(':');
  const port = parseInt(parts.pop());
  const address = parts.join();
  return { address, port };
}

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
    //This function will be invoked when a remote node connects to this node.

    remoteNodeSocket.on('data', rawData => {
      const data = JSON.parse(rawData.toString());
      console.log(`[${P2P_PORT}] Data received:`, data);
      switch (data.type) {
        case MESSAGE_TYPE_ADDR:
          const peer = data.payload;
          const splittedAddress = splitSocketAddress(peer);
          if (typeof peerNodes[peer] === 'undefined') {
            //Add this peer to my list of peers
            peerNodes[peer] = { ...splittedAddress, timestamp: Date.now() };
            //Send this peer my blockchain in case it's longer that its one
            broadcastBlockchain();
            //Announce this peer to the rest of connected peers
            annouceNode(splittedAddress);
          } else {
            //Update its keepalive time
            peerNodes[peer].timestamp = Date.now();
          }
          break;
        case MESSAGE_TYPE_INVENTORY:
          const candidateBlockchain = data.payload;
          if (
            candidateBlockchain.length > blockchain.length &&
            blockchain[0] === candidateBlockchain[0]
          ) {
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
  console.log(
    `[${P2P_PORT}] Broadcasting blockchain to nodes`,
    Object.keys(peerNodes)
  );
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

//Anounce as new node to the P2P network
function annouceNode(params) {
  const { address, port } = params;
  for (let index in peerNodes) {
    if (
      //Do not announce a node to itself
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
annouceNode({ address: P2P_ADDR, port: P2P_PORT });
//Send my blockchain
broadcastBlockchain();

//Keep announcing myself while I'm alive
setInterval(() => {
  const now = Date.now();
  annouceNode({ address: P2P_ADDR, port: P2P_PORT });
  console.log(
    `[${P2P_PORT}] List of up to date peers:`,
    Object.keys(peerNodes)
  );
  console.log(`[${P2P_PORT}] Current blockchain:`, blockchain);
}, ANNOUNCE_IM_ALIVE_TIME);

//Detect and remove disconnected nodes
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

//Create a web server so that the wallet can connect to using HTTP POST messages
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
  res.send(`${JSON.stringify(blockchain)}`);
});
app.listen(HTTP_PORT);
