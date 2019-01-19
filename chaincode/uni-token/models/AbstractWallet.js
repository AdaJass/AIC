const {ChaincodeError, utils} = require('@kunstmaan/hyperledger-fabric-node-chaincode-utils');

const CONSTANTS = require('./../common/constants');
const ERRORS = require('./../common/constants/errors');

const logger = utils.logger.getLogger('models/AbstractWallet');

class AbstractWallet {

    static async queryWalletByAddress(txHelper, address) {
        const dbData = await txHelper.getStateAsObject(address);

        return mapDBDataToObject(dbData);
    }

    static async queryWallets(txHelper, type, query) {
        const allResults = await txHelper.getQueryResultAsList({
            'selector': {
                '$and': [
                    {
                        'type': type
                    },
                    query
                ]
            }
        });

        logger.debug(`Query Result ${allResults}`);

        return allResults.map((result) => result.record).map(mapDBDataToObject);
    }

    get properties() {

        return {};
    }

    set properties(value) {
        // ABSTRACT doesn't have properties, do nothing
    }

    constructor({address, amount = 0.0, type = 'abstract'}) {
        this.address = address;
        this.amount = amount;
        this.type = type;
    }

    addAmount(amount) {
        this.amount += amount;

        return this;
    }

    canSpendAmount(amount) {

        return this.amount - amount >= 0;
    }

    txCreatorHasPermissions() {

        return false;
    }

    
}

module.exports = AbstractWallet;

