const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const validUser = {
  username: "user1",
  email: "user1@mail.com",
  password: "P4ssword",
};

const postUser = (user = validUser) => {
  return request(app).post("/api/1.0/users").send(user);
};

describe("User Registration", () => {
  it("returns 200 OK when signup request is valid", async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it("returns success message signup request is valid", async () => {
    const response = await postUser();
    expect(response.body.message).toBe("User created");
  });

  it("saves the user to database", async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it("saves the username and email to database", async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe("user1");
    expect(savedUser.email).toBe("user1@mail.com");
  });

  it("hashes the password in database", async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe("P4ssword");
  });

  it("returns 400 when username is null", async () => {
    const response = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "P4ssword",
    });
    expect(response.status).toBe(400);
  });

  it("returns validationErrors field in response body when validation error occur", async () => {
    const response = await postUser({
      username: null,
      email: "user1@mail.com",
      password: "P4ssword",
    });
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it("returns errors for both when username and email is null", async () => {
    const response = await postUser({
      username: null,
      email: null,
      password: "P4ssword",
    });
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  // it.each([
  //   ["username", "Username cannot be null"],
  //   ["email", "Email cannot be null"],
  //   ["password", "Password cannot be null"],
  // ])("when %s is null %s is received", async (field, expectedMessage) => {
  //   const user = {
  //     username: "user1",
  //     email: "user1@mail.com",
  //     password: "P4ssword",
  //   };
  //   user[field] = null;
  //   const response = await postUser(user);
  //   const body = response.body;
  //   expect(body.validationErrors[field]).toBe(expectedMessage);
  // });

  it.each`
    field         | value              | expectedMessage
    ${"username"} | ${null}            | ${"Username cannot be null"}
    ${"username"} | ${"usr"}           | ${"Must have min 4 and max 32 characters"}
    ${"username"} | ${"a".repeat(33)}  | ${"Must have min 4 and max 32 characters"}
    ${"email"}    | ${null}            | ${"Email cannot be null"}
    ${"email"}    | ${"mail.com"}      | ${"Email is not valid"}
    ${"email"}    | ${"user.mail.com"} | ${"Email is not valid"}
    ${"email"}    | ${"user@mail"}     | ${"Email is not valid"}
    ${"password"} | ${null}            | ${"Password cannot be null"}
    ${"password"} | ${"P4ssw"}         | ${"Password must be at least 6 characters"}
    ${"password"} | ${"alllowerCase"}  | ${"Password must be at least 1 lowercase letter and 1 number"}
    ${"password"} | ${"ALLUPPERCASE"}  | ${"Password must be at least 1 lowercase letter and 1 number"}
    ${"password"} | ${"1234567890"}    | ${"Password must be at least 1 lowercase letter and 1 number"}
    ${"password"} | ${"lowerandUPPER"} | ${"Password must be at least 1 lowercase letter and 1 number"}
    ${"password"} | ${"lower4nd5667"}  | ${"Password must be at least 1 lowercase letter and 1 number"}
    ${"password"} | ${"UPPER44444"}    | ${"Password must be at least 1 lowercase letter and 1 number"}
  `(
    "return $expectedMessage when $field is $value",
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: "user1",
        email: "user1@mail.com",
        password: "P4ssword",
      };
      user[field] = value;
      const response = await postUser(user);
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  // it("returns size validation error when username is less than 4 characters", async () => {
  //   const user = {
  //     username: "usr",
  //     email: "user1@mail.com",
  //     password: "P4ssword",
  //   };

  //   const response = await postUser(user);
  //   const body = response.body;
  //   expect(body.validationErrors.username).toBe(
  //     "Must have min 4 and max 32 characters"
  //   );
  // });
});
