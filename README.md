## Depoly Steps

### install and compile code.

```
npm install
npx hardhat compile
```

### Deploy contract and init params

```
vim deploy/01-deploy-OmnichainSwapProxy_spec.ts

- fill in right address to param "tomoRouter" according to different chain
```

### Deploy proxy contract

```
npx hardhat deploy --network ${NETWORK} --tags DeployOmnichainSwapProxy
```

### Set Relayer and Approval amount

```
vim deploy/02-set-relayerApprovalAmount_spec.ts

- fill in right address to param "omnichainSwapProxy/newRelayer/stableCoin"

npx hardhat deploy --network ${NETWORK} --tags SetRelayerApprovalAmount
```

### Set whitelist token

```
vim deploy/03-set-whitelist.ts

- fill in right address to param "whitelistedToken"

npx hardhat deploy --network ${NETWORK} --tags SetWhitelist
```

### Set Config params

```
vim deploy/04-set-ConfigParams.ts

- fill in right address to param "04-set-ConfigParams.ts"

npx hardhat deploy --network ${NETWORK} --tags SetConfigParams
```

### Test case

```
npx hardhat test
```

- run a signle test calse

```
npx hardhat test --grep "xxxxxxxx...."
```
