import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Provisions a real Cognito user; Cognito emails the temporary password. Returns the new user's sub. */
export async function provisionMember(params: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<string> {
  const userPoolId = requireEnv("COGNITO_USER_POOL_ID");
  const result = await client.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: params.email,
      UserAttributes: [
        { Name: "email", Value: params.email },
        { Name: "email_verified", Value: "true" },
        { Name: "given_name", Value: params.firstName },
        { Name: "family_name", Value: params.lastName },
      ],
      DesiredDeliveryMediums: ["EMAIL"],
    })
  );

  const sub = result.User?.Attributes?.find((a) => a.Name === "sub")?.Value;
  if (!sub) throw new Error("Cognito did not return a sub for the new user");
  return sub;
}
