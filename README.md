# etherscan-publisher
Verify and Publish your contract source code to [etherscan.io](https://etherscan.io)!

# Usage
```
选项：
      --help       显示帮助信息                                           [布尔]
      --version    显示版本号                                             [布尔]
  -a, --address    the address of the contract                   [字符串] [必需]
  -n, --name       the name of the contract                      [字符串] [必需]
  -c, --compiler   the compiler of the contract                  [字符串] [必需]
  -p, --path       the path of the contract source code          [字符串] [必需]
  -k, --apikey     etherscan apikey                              [字符串] [必需]
  -t, --argtypes   the types of constructor args, split by ',', i.e
                   address,uint256,uint256                 [字符串] [默认值: ""]
  -v, --argvalues  the values of constructor args, split by ',', i.e 0x123,1,2
                                                           [字符串] [默认值: ""]
  -w, --network    ethereum network                 [字符串] [默认值: "mainnet"]
  -l, --license    contract license types                               [字符串]
  -o, --proxy      http proxy host, i.e 127.0.0.1:1087                  [字符串]
```

# Example
1. If your contract uses import, you should run truffle-flattener first.
```
truffle-flattener mycontract.sol --output myoutput.sol
```
2. Use epr to publish your contract source code.
```
npm i -g etherscan-publisher

epr --address 0x15649cB44eb918b3edE577450F41191808F87bac --compiler v0.6.2+commit.bacdbe57 --name test123 --path ./myoutput.sol --network ropsten --apikey yourapikey --license MIT --argtypes address,uint256 --argvalues 0x19965F3321Cf4811CF0686546a69216fF04628b0,8 -o 127.0.0.1:1087

```