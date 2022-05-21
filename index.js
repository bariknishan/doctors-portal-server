const express = require('express')

const jwt = require('jsonwebtoken');
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

// middleware

app.use(cors());
app.use(express.json())

// DATABASE 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hulhk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

/// jwt token access 

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'unAuthorized access' })
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {

        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }

        req.decoded = decoded;
        next()

    });
}


async function run() {
    try {
        await client.connect();

        const serviceCollection = client.db('doctors_portal').collection('services')
        const bookingCollection = client.db('doctors_portal').collection('bookings')
        const userCollection = client.db('doctors_portal').collection('users')
        const doctorsCollection = client.db('doctors_portal').collection('doctors')

        //// doctors admin verify
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })

            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'forbidden' })
            }
        }

        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const service = await cursor.toArray()
            res.send(service)

        })


        // all users 
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })


        // admin check //////////////////////

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })


        // addminnnnnnnn 

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updateDoc = {  $set: { role: 'admin' }, };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        ///////// update

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })

        ///// thise is not proper way there is another way in mongodb,pipeline etc match, group etc
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            /// step 1
            const services = await serviceCollection.find().toArray();

            // steo2 get the booking day 
            const query = { date: date };

            const bookings = await bookingCollection.find(query).toArray()

            // step 3 for aech service booking for that service 
            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name)

                // step 4 slect slot for service slot is a string
                const bookedSlotes = serviceBookings.map(book => book.slot)


                // step6 select those slote which are not in bookslotes

                const available = service.slots.filter(slot => !bookedSlotes.includes(slot));
                service.slots = available;
            })

            res.send(services)


        })

        /// booking appointment system

        app.get('/booking', verifyJWT, async (req, res) => {

            const patient = req.query.patient;
            const authorization = req.headers.authorization;
            // console.log('auth header', authorization)
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                // console.log(patient,query);
                const bookings = await bookingCollection.find(query).toArray()
                // console.log(bookings)
                return res.send(bookings)
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }
        })


        //////// naming  

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking)
            return res.send({ success: true, result })
        })


        // doctors api

        app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) =>{
             const doctors= await doctorsCollection.find().toArray();
             res.send(doctors);
        })
        
        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);

        })
 /// doctors delet api

        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter={email:email};

            const result = await doctorsCollection.deleteOne(filter);
            res.send(result);

        })












    }
    finally {

    }
}
run().catch(console.dir)



app.get('/', (req, res) => {
    res.send('Hello Doctors')
})

app.listen(port, () => {
    console.log(' server listening on port', port)
})