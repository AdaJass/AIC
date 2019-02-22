#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# Exit on first error
set -e

# don't rewrite paths for Windows Git Bash users
export MSYS_NO_PATHCONV=1
starttime=$(date +%s)
# CC_SRC_LANGUAGE=${1:-"go"}
# CC_SRC_LANGUAGE=`echo "$CC_SRC_LANGUAGE" | tr [:upper:] [:lower:]`

CC_RUNTIME_LANGUAGE=node # chaincode runtime language is node.js
CC_SRC_PATH_AGENT=/opt/gopath/src/github.com/agentmonitor
CC_SRC_PATH_WALLET=/opt/gopath/src/github.com/unicoin


# clean the keystore
rm -rf ./hfc-key-store

# launch network; create channel and join peer to channel

# docker kill logspout

cd ./basic-network
docker stop $(docker ps -a | awk '{ print $1}' | tail -n +2)
docker rm $(docker ps -a | awk '{ print $1}' | tail -n +2)
docker rmi $(docker images dev-* -q)
# ./init.sh
./start.sh

# Now launch the CLI container in order to install, instantiate chaincode
# and prime the ledger with our 10 cars
docker-compose -f ./docker-compose.yml up -d cli

docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode install -n uniagent -v 1.0 -p "$CC_SRC_PATH_AGENT" -l "$CC_RUNTIME_LANGUAGE"

docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode instantiate -o orderer.example.com:7050 -C mychannel -n uniagent -l "$CC_RUNTIME_LANGUAGE" -v 1.0 -c '{"Args":[]}' -P "OR ('Org1MSP.member','Org2MSP.member')"

sleep 3
echo "hehehehehehehehehehehehehhehehehehehehehehehehehehehehe"

docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode invoke -o orderer.example.com:7050 -C mychannel -n uniagent -c '{"function":"init","Args":[]}'

##########################################################################################################################################################################################

docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode install -n unicoin -v 1.0 -p "$CC_SRC_PATH_WALLET" -l "$CC_RUNTIME_LANGUAGE"

docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode instantiate -o orderer.example.com:7050 -C mychannel -n unicoin -l "$CC_RUNTIME_LANGUAGE" -v 1.0 -c '{"Args":[]}' -P "OR ('Org1MSP.member','Org2MSP.member')"

sleep 3
echo "hahahahhaahahahahaahahahahahahahahahahahahahhaahahhaha"

docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode invoke -o orderer.example.com:7050 -C mychannel -n unicoin -c '{"function":"initUnionCoin","Args":[]}'

cd ..
./monitordocker.sh

#$(npm bin)/fabric-chaincode-node start --peer.address 192.168.99.100:7052 --chaincode-id-name mychannel
# cat <<EOF

# Total setup execution time : $(($(date +%s) - starttime)) secs ...

# Next, use the Fabcar applications to interact with the deployed Fabcar contract.
# The Fabcar applications are available in multiple programming languages.
# Follow the instructions for the programming language of your choice:

# JavaScript:

#   Start by changing into the "javascript" directory:
#     cd javascript

#   Next, install all required packages:
#     npm install

#   Then run the following applications to enroll the admin user, and register a new user
#   called user1 which will be used by the other applications to interact with the deployed
#   Fabcar contract:
#     node enrollAdmin
#     node registerUser

#   You can run the invoke application as follows. By default, the invoke application will
#   create a new car, but you can update the application to submit other transactions:
#     node invoke

#   You can run the query application as follows. By default, the query application will
#   return all cars, but you can update the application to evaluate other transactions:
#     node query

# TypeScript:

#   Start by changing into the "typescript" directory:
#     cd typescript

#   Next, install all required packages:
#     npm install

#   Next, compile the TypeScript code into JavaScript:
#     npm run build

#   Then run the following applications to enroll the admin user, and register a new user
#   called user1 which will be used by the other applications to interact with the deployed
#   Fabcar contract:
#     node dist/enrollAdmin
#     node dist/registerUser

#   You can run the invoke application as follows. By default, the invoke application will
#   create a new car, but you can update the application to submit other transactions:
#     node dist/invoke

#   You can run the query application as follows. By default, the query application will
#   return all cars, but you can update the application to evaluate other transactions:
#     node dist/query

# EOF
