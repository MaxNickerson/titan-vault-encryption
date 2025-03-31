export async function verifyJwt(token: string): Promise<any> {
    // Dev only — fake auth
    return {
      sub: "test-user-123",
      email: "test@example.com",
    };
  }
  