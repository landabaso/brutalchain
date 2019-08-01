#!/bin/bash

#capture a CTRL-C
onINT() {
  kill -INT "$commad1PID"
  kill -INT "$commad2PID"
  kill -INT "$commad3PID"
  exit
}

HTTP_PORT=20001 P2P_PORT=10001 npm run honestNodesOneMessagePerBlock &
command1PID="$!" #grab the pid

sleep 0.5
HTTP_PORT=20002 P2P_PORT=10002 REMOTE_PEERS=localhost:10001 npm run honestNodesOneMessagePerBlock &
command2PID="$!" #grab the pid

sleep 0.5
HTTP_PORT=20003 P2P_PORT=10003 REMOTE_PEERS=localhost:10001 npm run honestNodesOneMessagePerBlock &
command3PID="$!" #grab the pid

sleep 2
curl -H "Content-type:application/json" --data '{"message" : "First message"}' http://localhost:20002/produceBlock >& /dev/null

sleep 2
curl -H "Content-type:application/json" --data '{"message" : "Second message"}' http://localhost:20001/produceBlock >& /dev/null

sleep 2
curl -H "Content-type:application/json" --data '{"message" : "Third message"}' http://localhost:20003/produceBlock >& /dev/null

wait

