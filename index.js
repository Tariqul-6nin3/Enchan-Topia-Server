const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(
  "sk_test_51NI2P3HUp9RdPjle4CpqbaQptzExWRYySOJqddPBBLeQQ9umJLLxJX3sIOyOM7XCa7PwGyOzxUNMc699U1VIaJs800YwL1bN83"
);
const bodyParser = require("body-parser");

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// mongodb operations

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { verifyJwt } = require("./middleware/verifyJwt");
const verifyRole = require("./middleware/verifyRole");
const uri = `mongodb+srv://${process.env.USER_USERNAME}:${process.env.USER_PASSWORD}@cluster0.jsico6b.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classCollection = client.db("enchanTopiaDB").collection("classes");
    const usersCollection = client.db("enchanTopiaDB").collection("users");
    const selectedClassCollection = client
      .db("enchanTopiaDB")
      .collection("selectedClass");
    const bookedClassCollection = client
      .db("enchanTopiaDB")
      .collection("bookedClass");
    const addedClassCollection = client
      .db("enchanTopiaDB")
      .collection("addedClass");

    // generate client secret
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price) * 100;
      if (!price) return;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // get all classes as per descending with the number of students

    app.get("/popularClass", async (req, res) => {
      const cursor = classCollection
        .find()
        .sort({ number_of_students: -1 })
        .limit(6);

      const result = await cursor.toArray();
      res.send(result);
    });

    // send all the users to users collection
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      console.log(result);
      res.send(result);
    });

    // get all added class by instructor

    app.get("/myclass", async (req, res) => {
      const email = req.query.email;
      const query = { addedby: email };
      const cursor = await addedClassCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get selected classes
    app.get("/selected/:email", async (req, res) => {
      const email = req.params.email; // Access email as a route parameter
      const query = { email: email };
      const cursor = await bookedClassCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // delete selected classes
    app.delete("/selected/:email", async (req, res) => {
      const classId = req.params.email;
      console.log(classId);
      const query = { instructorEmail: classId };

      try {
        const result = await bookedClassCollection.deleteOne(query);
        console.log("this is result", { result });
        res.send(result);
      } catch (error) {
        console.log("Error deleting class:", error);
        res.status(500).send("Error deleting class");
      }
    });

    //get the logged in user
    app.get("/users", async (req, res) => {
      const { email } = req.query;
      const user = await usersCollection.findOne({ email });
      res.json(user);
    });

    // Get user from the database by email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const user = await usersCollection.findOne({ email });
        if (user) {
          res.json(user);
        } else {
          res.status(404).json({ error: "User not found" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ error: "An error occurred while retrieving the user" });
      }
    });

    // get specific user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    // post new class added by instructor
    app.post("/newclass", async (req, res) => {
      const addedClass = req.body;

      const result = await addedClassCollection.insertOne(addedClass);
      console.log(result);

      if (result.insertedId) {
        res.send({ insertedId: result.insertedId });
      } else {
        res.status(500).send({ message: "Failed to insert class" });
      }
    });

    // post booked class in database
    app.post("/bookedclass", async (req, res) => {
      const bookedClass = req.body;
      const result = await bookedClassCollection.insertOne(bookedClass);
      console.log(result);
      res.send(result);
    });

    // get all user from db to show manage user
    app.get("/alluser", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // make the user role to admin and instructor
    app.patch(
      "/users/:userId",
      verifyJwt,
      verifyRole("admin"),
      async (req, res) => {
        try {
          const userId = req.params.userId;
          console.log(userId);
          const role = req.body;
          console.log(role);
          const filter = { _id: new ObjectId(userId) };
          const options = { upsert: true };
          const update = { $set: role };

          const result = await usersCollection.updateOne(
            filter,
            update,
            options
          );
          res.send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send("Error updating user role");
        }
      }
    );

    // update the staus
    app.patch(
      "/classes/:userId",
      verifyJwt,
      verifyRole("admin"),
      async (req, res) => {
        try {
          const userId = req.params.userId;
          console.log(userId);
          const status = req.body;
          console.log(status);
          const filter = { _id: new ObjectId(userId) };
          const options = { upsert: true };
          const update = { $set: status };

          const result = await addedClassCollection.updateOne(
            filter,
            update,
            options
          );
          res.send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send("Error updating user role");
        }
      }
    );

    // get all class as per status
    app.get("/allclass", async (req, res) => {
      const cursor = addedClassCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // get all instructor information here
    app.get("/instructors", async (req, res) => {
      const cursor = addedClassCollection.find().project({
        instructorName: true,
        instructorEmail: true,
        instructorImage: true,
        numOfStudents: true,
      });
      const result = await cursor.toArray();
      res.send(result);
    });

    // get all approved class
    app.get("/approvedclass", async (req, res) => {
      const query = {
        status: "approved",
      };
      const cursor = addedClassCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await selectedClassCollection.insertOne(booking);
      console.log(result);
      res.send({ insertedId: result.insertedId }); // Send only the insertedId field
    });

    app.patch("/class/status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          booked: status,
        },
      };
      const update = await selectedClassCollection.updateOne(query, updateDoc);
      res.send(update);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
