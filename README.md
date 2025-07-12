MetaMask Setup & Wallet Connection
✅ 1. Install MetaMask
Go to https://metamask.io/

Click “Download” and install the extension for your browser (Chrome or Firefox)

Create a new wallet or import an existing one using a seed phrase

Make sure you're connected to a test network like:

Goerli

Sepolia

Polygon Mumbai (optional)

✅ 2. Add Test ETH (for testing)
Visit a testnet faucet (e.g., Goerli Faucet)

Paste your wallet address and request test ETH

✅ 3. Connect MetaMask to Your DApp
When you open your frontend (usually index.html):

Click “Connect Wallet” or the MetaMask icon/button in your app

MetaMask will prompt: “Allow this site to connect to your wallet?”

Click “Connect” and choose your account

The connected wallet address will now be available to interact with smart contracts

🚀 Running the Python Backend
If your project includes a Python backend (e.g. to serve the frontend or interface with smart contracts):

🔧 How to Run
bash
Copy
Edit
python main.py
Ensure you have Python installed (python --version) and all required modules (e.g. Flask, web3.py). You can install dependencies via:

bash
Copy
Edit
pip install -r requirements.txt
Once running, the backend will typically be available at:

cpp
Copy
Edit
http://127.0.0.1:5000/
You can open this in your browser to interact with the DApp frontend and MetaMask.
