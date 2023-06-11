const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

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
    const bookedClassCollection = client
      .db("enchanTopiaDB")
      .collection("bookedClass");
    const addedClassCollection = client
      .db("enchanTopiaDB")
      .collection("addedClass");

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

    // Fetch user by email
    app.get("/users", async (req, res) => {
      const { email } = req.query;
      const userData = await usersCollection.findOne({ email });
      res.json(userData);
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
