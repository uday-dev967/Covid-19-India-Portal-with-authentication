const express = require("express");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const app = express();
app.use(express.json());
let db = null;
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "udaynikhwify", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

const convertDBObjToResponseObj = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
    districtId: obj.district_id,
    districtName: obj.district_name,
    cases: obj.cases,
    active: obj.active,
    cured: obj.cured,
    deaths: obj.deaths,
  };
};

//GET ### STATES API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT
              *
            FROM
             state
            ORDER BY
             state_id;`;
  const stateArray = await db.all(getStatesQuery);
  const obj = stateArray.map((state) => convertDBObjToResponseObj(state));
  response.send(obj);
});

//GET ### STATES BY ID API
app.get("/states/:stateid", authenticateToken, async (request, response) => {
  const { stateid } = request.params;
  const getStatesQuery = `
            SELECT
              *
            FROM
             state
            WHERE
             state_id = ${stateid};`;
  const stateArray = await db.get(getStatesQuery);
  const obj = convertDBObjToResponseObj(stateArray);
  response.send(obj);
});

// POST ### ADD DISTRICT API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
  INSERT INTO
    district (district_name, state_id, cases, cured,active,deaths)
  VALUES
    ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const newDistrict = await db.run(createDistrictQuery);
  const district_id = newDistrict.lastID;
  response.send("District Successfully Added");
});

//GET ### DISTRICT BY ID API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
            SELECT
              *
            FROM
             district
            WHERE
             district_id = ${districtId};`;
    const districtArr = await db.get(getDistrictQuery);
    const obj = convertDBObjToResponseObj(districtArr);
    response.send(obj);
  }
);

// DELETE ### DELETE DISTRICT BY ID API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
        district
    WHERE
        district_id = ${districtId};`;
    const removeDistrict = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// POST ### NEW USER REGISTRATION API
app.post("/users", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbuser = await db.get(selectUserQuery);
  if (dbuser === undefined) {
    const createNewUserQuery = `INSERT INTO user (username, name, password, gender, location)
                VALUES 
                (
                '${username}', 
                '${name}',
                '${hashedPassword}', 
                '${gender}',
                '${location}'
                );`;
    await db.run(createNewUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// POST ### USER LOGIN API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbuser = await db.get(selectUserQuery);
  if (dbuser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(password, dbuser.password);
    if (isCorrectPassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "udaynikhwify");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// PUT ### UPDATE DISTRICT BY ID API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
      UPDATE 
        district
      SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
      WHERE 
        district_id = ${districtId};`;
    const updatedDistrict = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// GET ### GET STATS OF A STATE BY ID API 7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
        SELECT
            SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(active) as totalActive,
            SUM(deaths) as totalDeaths
        FROM
            district
        WHERE 
            state_id = ${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    console.log(stats);
    response.send(stats);
  }
);

module.exports = app;
