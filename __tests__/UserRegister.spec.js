const request = require("supertest");
const app = require("../src/app");
const User = require("../src/user/User");
const sequelize = require("../src/config/database");
const { describe } = require("../src/user/User");
const SMTPServer = require("smtp-server").SMTPServer;

let lastMail, server;
let simulateSmtpFailure = false;
beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on("data", (data) => {
        mailBody += data.toString();
      });
      stream.on("end", () => {
        if (simulateSmtpFailure) {
          const err = new Error("Invalid mailbox");
          err.responseCode = 553;
          return callback(err);
        }
        lastMail = mailBody;
        callback();
      });
    },
  });
  await server.listen(8587, "localhost");

  await sequelize.sync();
});

beforeEach(() => {
  simulateSmtpFailure = false;
  return User.destroy({ truncate: true });
});

afterAll(async () => {
  await server.close();
});

const validUser = {
  username: "user1",
  email: "user1@mail.com",
  password: "P4ssword",
};

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post("/api/1.0/users");
  if (options.language) {
    agent.set("Accept-Language", options.language);
  }
  return agent.send(user);
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

  const username_null = "Username cannot be null";
  const username_size = "Must have min 4 and max 32 characters";
  const email_null = "Email cannot be null";
  const email_invalid = "Email is not valid";
  const password_null = "Password cannot be null";
  const password_size = "Password must be at least 6 characters";
  const password_pattern =
    "Password must be at least 1 lowercase letter and 1 number";
  const email_inuse = "Email in use";

  it.each`
    field         | value              | expectedMessage
    ${"username"} | ${null}            | ${username_null}
    ${"username"} | ${"usr"}           | ${username_size}
    ${"username"} | ${"a".repeat(33)}  | ${username_size}
    ${"email"}    | ${null}            | ${email_null}
    ${"email"}    | ${"mail.com"}      | ${email_invalid}
    ${"email"}    | ${"user.mail.com"} | ${email_invalid}
    ${"email"}    | ${"user@mail"}     | ${email_invalid}
    ${"password"} | ${null}            | ${password_null}
    ${"password"} | ${"P4ssw"}         | ${password_size}
    ${"password"} | ${"alllowerCase"}  | ${password_pattern}
    ${"password"} | ${"ALLUPPERCASE"}  | ${password_pattern}
    ${"password"} | ${"1234567890"}    | ${password_pattern}
    ${"password"} | ${"lowerandUPPER"} | ${password_pattern}
    ${"password"} | ${"lower4nd5667"}  | ${password_pattern}
    ${"password"} | ${"UPPER44444"}    | ${password_pattern}
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

  it(`returns ${email_inuse} when same email is already in use`, async () => {
    await User.create({ ...validUser });
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe(email_inuse);
  });

  it("returns errors for both username is null and email is in use", async () => {
    await User.create({ ...validUser });
    const response = await postUser({
      username: null,
      email: validUser.email,
      password: "P4ssword",
    });

    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(["username", "email"]);
  });

  it("creates user in inactive mode", async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it("creates user in inactive mode even the request body contains inactive as false", async () => {
    const newUser = {
      ...validUser,
      inactive: false,
    };
    await postUser(newUser);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it("creates an activationToken for user", async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it("sends an Account activation email with activationToken", async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain("user1@mail.com");
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it("returns 502 Bad Gateway when sending email fails", async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.status).toBe(502);
  });

  it("returns Email failure message when sending mail fails", async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe("Email Failure");
  });

  it("does not save user to database if activation email fails", async () => {
    simulateSmtpFailure = true;
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });
});

// INTERNATIONALIZATION PART
describe("Internationalization", () => {
  const username_null = "Kullanıcı adı boş olamaz";
  const username_size = "En az 4 en fazla 32 karakter olmalıdır";
  const email_null = "E-posta boş olamaz";
  const email_invalid = "E-posta geçerli değil";
  const password_null = "Parola boş olamaz";
  const password_size = "Şifre en az 6 karakter olmalıdır";
  const password_pattern =
    "Şifre en az 1 küçük harf ve 1 rakamdan oluşmalıdır.";
  const email_inuse = "E-posta kullanımda";
  const user_create_success = "Kullanıcı oluşturuldu";
  const email_failure = "E-posta Hatası";

  it.each`
    field         | value              | expectedMessage
    ${"username"} | ${null}            | ${username_null}
    ${"username"} | ${"usr"}           | ${username_size}
    ${"username"} | ${"a".repeat(33)}  | ${username_size}
    ${"email"}    | ${null}            | ${email_null}
    ${"email"}    | ${"mail.com"}      | ${email_invalid}
    ${"email"}    | ${"user.mail.com"} | ${email_invalid}
    ${"email"}    | ${"user@mail"}     | ${email_invalid}
    ${"password"} | ${null}            | ${password_null}
    ${"password"} | ${"P4ssw"}         | ${password_size}
    ${"password"} | ${"alllowerCase"}  | ${password_pattern}
    ${"password"} | ${"ALLUPPERCASE"}  | ${password_pattern}
    ${"password"} | ${"1234567890"}    | ${password_pattern}
    ${"password"} | ${"lowerandUPPER"} | ${password_pattern}
    ${"password"} | ${"lower4nd5667"}  | ${password_pattern}
    ${"password"} | ${"UPPER44444"}    | ${password_pattern}
  `(
    "return $expectedMessage when $field is $value when language is set as turkish",
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: "user1",
        email: "user1@mail.com",
        password: "P4ssword",
      };
      user[field] = value;
      const response = await postUser(user, { language: "tr" });
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it(`returns ${email_inuse} when same email is already in use when language is set as turkish`, async () => {
    await User.create({ ...validUser });
    const response = await postUser({ ...validUser }, { language: "tr" });
    expect(response.body.validationErrors.email).toBe(email_inuse);
  });

  it(`returns success message of ${user_create_success} when signup request is valid and language is set as turkish`, async () => {
    const response = await postUser({ ...validUser }, { language: "tr" });
    expect(response.body.message).toBe(user_create_success);
  });

  it(`returns ${email_failure} message when sending mail fails and language is set as turkish`, async () => {
    simulateSmtpFailure = true;
    const response = await postUser({ ...validUser }, { language: "tr" });
    expect(response.body.message).toBe(email_failure);
  });
});

describe("Account activation", () => {
  it("activates the account when correct otken is sent", async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post("api/1.0/users/token/" + token)
      .send();
    users = await User.findAll();
    expect(users[0].inactive).toBe(false);
  });
});
