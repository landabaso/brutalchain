# brutalchain
A brutally simple blockchain written in Javascript ES6.

## Motivation
To develop a proof-of-work cryptocurrency in different steps with an educational purpose.

I start developing the minimum possible implementation of a Blockchain. Each attempt will include more functionalities so that the developer/student/aficionado can learn step by step how a blockchain works.

## First attempt

Let's define a blockchain as a digital record of messages kept in a P2P network. The name comes from its structure, in which individual records, called blocks, are linked together in single list, called a chain.
This first implementation honors the minimum possible implementation of the definition above. 

### Limitations of the first implementation:

Let's start by listing the limitations of this first approach:

* It assumes all nodes are honest. Thus, there is no need for proof of work.
* It's not a cryptocurrency blockchain. The blockchain consists of a chain of blocks where a block contains a message (a string).
* Blocks are not created on a time base (as in 10 minutes per block in Bitcoin). Instead, one block is produced (mined) per each message received.
* Nodes propagate all the blocks (beginning from the genesis block) once they receive a new message.

### Features:
* Full P2P functionality using TCP sockets. Nodes connect to each other to announce themselves and ping each other regularly to show they are still available.
* Nodes keep the longest chain as the valid chain.
* A simple HTTP server is also provided so that a client (a wallet) can send a message to any node of the Blockchain.
* The HTTP server also can also be used as a very simple block explorer.

### Installation:
```
git clone https://github.com/landabaso/brutalchain.git
cd brutalchain
npm install

#This will create 3 nodes on your computer and send some messages on the Blockchain
bash runHonestNodesOneMessagePerBlock.bash
#You can send more messages by doing:
curl -H "Content-type:application/json" --data '{"message" : "My new message"}' http://localhost:20003/produceBlock
#You can also kill some of the clients and see how the list of peers on each node are atumatically updated
ps aux | grep honestNodesOneMessagePerBlock
kill [PUT HERE A PID]
#You can launch more nodes and see how they are added to the P2P network
#You must choose an available port for the HTTP server so that a client (a wallet) can connect to produce (mine) a message.
#You must also set an available port for the P2P socket.
#Finally, you must seed the socket address of an existing node (if available). REMOTE_PEERS can also be a list such as:REMOTE_PEERS=localhost:10001,localhost:10002. However, a single node is enough since the addresses are automatically propagated.
HTTP_PORT=20004 P2P_PORT=10004 REMOTE_PEERS=localhost:10001 npm run honestNodesOneMessagePerBlock
```
You can also open a browser window to explore the network on only of the nodes. For example you can explore the blockchain by opening this URL `http://localhost:20001/`

## Second attempt:
The second attempt includes a proof-of-work mechanism so that the network cannot be spammed.
Work in progress.

