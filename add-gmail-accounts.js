const mongoose = require('mongoose');


const accountSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  imapConfig: {
    host: { type: String, required: true },
    port: { type: Number, required: true },
    secure: { type: Boolean, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true }
  },
  isActive: { type: Boolean, default: true },
  lastSync: Date,
  syncStatus: { type: String, enum: ['idle', 'syncing', 'error'], default: 'idle' }
}, { timestamps: true });

const Account = mongoose.model('Account', accountSchema);

async function addGmailAccounts() {
  try {

    await mongoose.connect("mongo connectionstring");
    console.log('Connected to MongoDB');


    const accounts = [
      {
        email: 'youraccount@gmail.com',
        imapConfig: {
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          username: 'youraccount@gmail.com',
          password: 'password' // 16-character app password
        }
      },
      // Add second account when you have another Gmail
      {
        email: 'youraccount@gmail.com',
        imapConfig: {
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          username: 'youraccount@gmail.com',
          password: 'password'
        }
      }
    ];

    // Insert accounts
    for (const accountData of accounts) {
      try {
        const account = new Account(accountData);
        await account.save();
        console.log(`✅ Added account: ${accountData.email}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  Account already exists: ${accountData.email}`);
        } else {
          console.error(`❌ Error adding ${accountData.email}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Gmail accounts setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addGmailAccounts();