import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract, utils } from "ethers"
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import Button from "@mui/material/Button"
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useForm, Controller, SubmitHandler} from "react-hook-form";
import Input from "@material-ui/core/Input";
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from "yup";

type FormData = {
    Name: string;
    Age: number;
    Address: string;

  };
const schema = yup.object().shape({
    Name: yup.string().required(),
    Age: yup.number().required().positive().integer(),
    Address: yup.string(),
  });

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [Greeting, setGreeting] = React.useState("")
    const { handleSubmit, control, formState: { errors } } = useForm<FormData>({
        // useFormの引数にyupResolverを設定
        resolver: yupResolver(schema)
      });
    // const onSubmit = handleSubmit(data => console.log(JSON.stringify(data))); 
    const onSubmit = handleSubmit(data => greet(JSON.stringify(data))); 

    async function EventListener() {
        console.log("start listening")
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider)

        contract.on("NewGreeting", (e:string) => {
        console.log("NewGreeting Event:");
        console.log(utils.parseBytes32String(e));
        setGreeting("New Greeting event detected: ", utils.parseBytes32String(e))
    })
    }

    async function greet(data) {
        setLogs("Creating your Semaphore identity...")
        console.log(data)
        EventListener()
        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <meta name="viewport" content="initial-scale=1, width=device-width" />
                <link rel="icon" href="/favicon.ico" />
                <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"/>
                <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons"/>
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>
                <Box
                    component="form"
                    marginTop="50px"
                    width="100%"
                    display="flex"
                    flexDirection="column"
                    justifyContent="center"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <Controller
                        name="Name"
                        control={control}
                        defaultValue=""
                        render={({
                            field: { onChange, onBlur, value, name, ref },
                            fieldState: { invalid, isTouched, isDirty, error },
                          }) => (
                            <TextField
                              label="Name"
                              placeholder="David"
                              required
                              value={value}
                              variant="outlined"
                              margin="dense"
                              onChange={onChange}
                              onBlur={onBlur}
                              error={"Name" in errors}
                              helperText={errors.Name?.message}
                            />
                          )}
                    />
                    <Controller
                            name="Age"
                            control={control}
                            defaultValue=""
                            render={({
                                field: { onChange, onBlur, value, name, ref },
                                fieldState: { invalid, isTouched, isDirty, error },
                              }) => (
                                <TextField
                                  label="Age"
                                  placeholder="24"
                                  required
                                  value={value}
                                  variant="outlined"
                                  margin="dense"
                                  onChange={onChange}
                                  onBlur={onBlur}
                                  error={"Age" in errors}
                                  helperText={errors.Age?.message}
                                />
                              )}
                    />
                    <Controller
                    name="Address"
                    control={control}
                    defaultValue=""
                    render={({
                        field: { onChange, onBlur, value, name, ref },
                        fieldState: { invalid, isTouched, isDirty, error },
                      }) => (
                        <TextField
                          label="Address"
                          placeholder="Tokyo, Shibuya district"
                          required
                          value={value}
                          variant="outlined"
                          margin="dense"
                          onChange={onChange}
                          onBlur={onBlur}
                          error={"Address" in errors}
                          helperText={errors.Address?.message}
                        />
                      )}
                    />      
                    <Button type="submit" color="primary" variant="contained" size="large">
                        submit
                    </Button>
                </Box>
                <div className={styles.logs}>{logs}</div>
                <div className={styles.logs}>{Greeting}</div>

                <div onClick={() => greet(data)} className={styles.button}>
                    Greet
                </div>
            </main>
        </div>
    )
}
