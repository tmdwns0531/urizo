import { services } from "@/composition";
import { errorResponse } from "../../_shared/http";

export async function GET(): Promise<Response> {
  try {
    const user = await services.profile.get();
    return Response.json({ authenticated: true, user });
  } catch (error) {
    return errorResponse(error);
  }
}
