#!/usr/bin/env node

const fs = require('fs')
const axios = require('axios')
const yargs = require('yargs')
const tracer = require('tracer')
const tunnel = require('tunnel')
const qs = require('qs')
const coder = require('web3-eth-abi')

const logger = tracer.colorConsole()
const argv = yargs(process.argv.slice(2)).options({
    'address': {
        alias: 'a',
        demandOption: true,
        describe: 'the address of the contract',
        type: 'string'
    },
    'name': {
        alias: 'n',
        demandOption: true,
        describe: 'the name of the contract',
        type: 'string'
    },
    'compiler': {
        alias: 'c',
        demandOption: true,
        describe: 'the compiler of the contract',
        type: 'string'
    },
    'path': {
        alias: 'p',
        demandOption: true,
        describe: 'the path of the contract source code',
        type: 'string'
    },
    'apikey': {
        alias: 'k',
        demandOption: true,
        describe: 'etherscan apikey',
        type: 'string'
    },
    'argtypes': {
        alias: 't',
        default: '',
        describe: 'the types of constructor args, split by \',\', i.e address,uint256,uint256',
        type: 'string'
    },
    'argvalues': {
        alias: 'v',
        default: '',
        describe: 'the values of constructor args, split by \',\', i.e 0x123,1,2',
        type: 'string'
    },
    'network': {
        alias: 'w',
        default: 'mainnet',
        describe: 'ethereum network',
        type: 'string'
    },
    'license': {
        alias: 'l',
        defaule: 'None',
        describe: 'contract license types',
        type: 'string'
    },
    'proxy': {
        alias: 'o',
        defaule: '',
        describe: 'http proxy host, i.e 127.0.0.1:1087',
        type: 'string'
    }
}).argv

let tunnelProxy
if (argv.proxy) {
    let arr = argv.proxy.split(':')
    if (arr.length !== 2) {
        logger.error(`invalid proxy: ${argv.proxy}`)
        process.exit(1)
    }
    let proxyHost = arr[0]
    let proxyPort = Number(arr[1])
    if (isNaN(proxyPort)) {
        logger.error(`invalid proxy port: ${arr[1]}`)
        process.exit(1)
    }
    tunnelProxy = tunnel.httpsOverHttp({
        proxy: {
            host: proxyHost,
            port: proxyPort
        }
    })
}

const func = (compilerversion) => {
    let argtypes = argv.argtypes === '' ? [] : argv.argtypes.split(',')
    let argvalues = argv.argvalues === '' ? [] : argv.argvalues.split(',')
    if (argtypes.length !== argvalues.length) {
        logger.error('invalid argtypes or argvalues, length not match')
        process.exit(1)
    }
    let constructorArguements = argtypes.length > 0 ? coder.encodeParameters(argtypes, argvalues) : ''
    // remove 0x
    constructorArguements = constructorArguements.length > 2 ? constructorArguements.substr(2) : ''

    let url
    switch(argv.network) {
        case 'mainnet':
            url = 'https://api.etherscan.io/api'
            break
        case 'ropsten':
            url = 'https://api-ropsten.etherscan.io/api'
            break
        case 'kovan':
            url = 'https://api-kovan.etherscan.io/api';
            break
        case 'rinkeby':
            url = 'https://api-rinkeby.etherscan.io/api';
            break
        case 'goerli':
            url = 'https://api-goerli.etherscan.io/api';
            break
        default:
            logger.error(`unkonw network type: ${argv.network}`)
            process.exit(1)
    }

    let sourceCode
    try {
        sourceCode = fs.readFileSync(argv.path).toString()
    }
    catch(err) {
        logger.error(`read file failed, error: ${err}`)
        process.exit(1)
    }

    const totalLicense = ['None', 'Unlicense', 'MIT', 'GNU GPLv2', 'GNU GPLv3', 'GNU LGPLv2.1', 'GNU LGPLv3', 'BSD-2-Clause', 'BSD-3-Clause', 'MPL-2.0', 'OSL-3.0', 'Apache-2.0', 'GNU AGPLv3']
    let license = totalLicense.indexOf(argv.license)
    if (license === -1) {
        logger.error(`unkonw license type: ${argv.license}`)
        process.exit(1)
    }
    license += 1;

    (async () => {
        try {
            let response = await axios.post(url, qs.stringify({
                apikey: argv.apikey,
                module: 'contract',
                action: 'verifysourcecode',
                contractaddress: argv.address,
                sourceCode,
                codeformat: 'solidity-single-file',
                contractname: argv.name,
                compilerversion,
                optimizationUsed: 0,
                runs: 200,
                constructorArguements,
                licenseType: license
            }), {
                httpsAgent: tunnelProxy
            })
            let data = response.data
            if (data.status !== '1' || data.message !== 'OK' || !data.result) {
                logger.error(`verifysourcecode failed, data: ${JSON.stringify(data)}`)
                process.exit(1)
            }
            let guid = data.result
        
            // wait for etherscan.
            const waitTime = 5;
            while (true) {
                let flag = 0
                for (let i = 0; i < waitTime + 1; i++) {
                    await new Promise((r) => setTimeout(r, 1000))
                    console.clear()
                    let char
                    switch (flag) {
                        case 0:
                            char = '-'
                            break;
                        case 1:
                            char = '/'
                            break;
                        case 2:
                            char = '|'
                            break;
                        case 3:
                            char = '\\'
                            break;
                    }
                    logger.info(`upload successfully, waiting for guid ${guid} ${i}/${waitTime}s ...${char}`)
                    flag++
                    if (flag === 4) {
                        flag = 0
                    }
                }
                console.clear()
            
                response = await axios.get(url, {
                    params: {
                        apikey: argv.apikey,
                        module: 'contract',
                        action: "checkverifystatus",
                        guid
                    },
                    httpsAgent: tunnelProxy
                })
                data = response.data
                if (data.status !== '1' || data.message !== 'OK') {
                    if (data.result.indexOf('Pending') !== -1) {
                        logger.info(`upload successfully, waiting for guid ${guid} retry...`)
                        await new Promise((r) => setTimeout(r, 1000))
                        continue
                    }
                    logger.error(`checkverifystatus failed, data: ${JSON.stringify(data)}`)
                    process.exit(1)
                }
                logger.info(`guid ${guid} publish successfully!`)
                process.exit(0)
            }
        }
        catch(err) {
            logger.error(`catch error: ${err}`)
            process.exit(1)
        }
    })()
}

if (argv.compiler.indexOf('commit') === -1) {
    const compilerInfoUrl = 'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/list.txt'
    axios.get(compilerInfoUrl, {
        httpsAgent: tunnelProxy
    }).then((response) => {
        let arr = response.data.split('\n')
        let compilerversion = arr.filter(name => name.indexOf('nightly') === -1).map(name => name.substr(8, name.length - 8 - 3)).find(name => name.indexOf(argv.compiler) !== -1)
        if (!compilerversion) {
            logger.error(`unkonw compiler verision: ${argv.compiler}`)
            process.exit(1)
        }
        func(compilerversion)
    }, (err) => {
        logger.error(`get compiler info failed, error: ${err}`)
        process.exit(1)
    })
}
else {
    func(argv.compiler)
}