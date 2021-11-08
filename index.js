const express = require('express')
const app = express()
const cors = require('cors')
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');




const port = process.env.PORT || 5000;


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);



admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// doctors-portal-firebase-adminsdk.json


// middleware 
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zsx3s.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function verifyToken(req, res, next) {
    // console.log(req.headers.authorization);
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        console.log(token);
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}


async function run() {
    try {
        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentCollection = database.collection('appointment');
        const usersCollection = database.collection('users')

        // GET API Appointment
        app.get('/appointment', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = req.query.date;

            const query = { email: email, date: date };
            const cursor = appointmentCollection.find(query);
            const appointment = await cursor.toArray();
            res.json(appointment);
        })

        // POST API appointment
        app.post('/appointment', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentCollection.insertOne(appointment);
            res.json(result)
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true
            }
            res.json({ admin: isAdmin })
        })

        // POST API users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result)
        })

        // UPDATE || UPSERT API users
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.json(result)
        })

        // Make an Admin 
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body
            const requester = req.decodedEmail
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = {
                        $set: { role: 'admin' }
                    };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result)
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }


        })
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello Doctors portal!')
})

app.listen(port, () => {
    console.log(`listening at port ${port}`)
})