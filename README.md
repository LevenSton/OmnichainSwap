# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

## Depoly Steps

1. npm install
2. npx hardhat compile
3. vim ./deploy/01-deploy-OmnichainSwapProxy_spec.ts to set all params(_universalRouter/_usdt/_weth9/_permit2/_initialOwner/_signers)
4. npx hardhat deploy --network ${NETWORK} --tags DeployOmnichainSwapProxy