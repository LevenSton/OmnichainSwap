import { expect } from 'chai';
import {
    makeSuiteCleanRoom,
    user,
    deployer,
    deployerAddress
} from '../__setup.spec';
import { ERRORS } from '../helpers/errors';
import { ethers } from 'hardhat';

makeSuiteCleanRoom('Execute OmnichainSwap ', function () {
    context('Generic', function () {

        context('Negatives', function () {
            it('User should fail to executeSrcUni if not owner.',   async function () {
                console.log('deployerAddress', deployerAddress);
            });
        })

        context('Scenarios', function () {
            it('Get correct variable if executeSrcUni success', async function () {
                console.log('deployerAddress', deployerAddress);
            });
        })
    })
})