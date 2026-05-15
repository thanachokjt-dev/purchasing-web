import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const USERS = [
  {
    displayName: "Jittavat Tesila",
    email: "jittavat.t@bangtaomuaythai.com",
    role: "super_admin",
  },
  {
    displayName: "Will",
    email: "will@bangtaomuaythai.com",
    role: "final_approver",
  },
  {
    displayName: "Kevin",
    email: "kevin@bangtaomuaythai.com",
    role: "preliminary_approver",
  },
  {
    displayName: "Lewis",
    email: "lewis@bangtaomuaythai.com",
    role: "reviewer",
  },
  {
    displayName: "Saytarn",
    email: "saytarn.a@bangtaomuaythai.com",
    role: "retail_manager",
  },
  {
    displayName: "Asama",
    email: "asama@bangtaomuaythai.com",
    role: "accounting",
  },
];

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function findUserByEmail(supabase, email) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user) {
      return user;
    }

    if (data.users.length < 100) {
      return null;
    }

    page += 1;
  }
}

async function ensureUser(supabase, user, temporaryPassword) {
  const email = user.email.toLowerCase();
  const existing = await findUserByEmail(supabase, email);
  let authUser = existing;

  if (existing) {
    console.log(`${email}: user exists`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: temporaryPassword,
      user_metadata: {
        display_name: user.displayName,
      },
    });

    if (error || !data.user) {
      throw error ?? new Error(`Could not create ${email}`);
    }

    authUser = data.user;
    console.log(`${email}: user created`);
  }

  await ensureProfile(supabase, {
    ...user,
    authUserId: authUser.id,
    email,
  });
}

async function ensureProfile(supabase, user) {
  const { data: profileByEmail, error: emailProfileError } = await supabase
    .from("user_profiles")
    .select("auth_user_id, display_name, email, is_active, role")
    .eq("email", user.email)
    .maybeSingle();

  if (emailProfileError) {
    throw emailProfileError;
  }

  const { data: profileByAuthId, error: authProfileError } = await supabase
    .from("user_profiles")
    .select("auth_user_id, display_name, email, is_active, role")
    .eq("auth_user_id", user.authUserId)
    .maybeSingle();

  if (authProfileError) {
    throw authProfileError;
  }

  const profile = profileByEmail ?? profileByAuthId;
  const target = {
    auth_user_id: user.authUserId,
    display_name: user.displayName,
    email: user.email,
    is_active: true,
    role: user.role,
  };

  if (profileByEmail && profileByAuthId && profileByEmail.email !== profileByAuthId.email) {
    throw new Error(
      `${user.email}: profile conflict found for email and auth_user_id. Resolve duplicate user_profiles rows manually.`,
    );
  }

  if (!profile) {
    const { error } = await supabase
      .from("user_profiles")
      .insert(target);

    if (error) {
      throw error;
    }

    console.log(`${user.email}: profile created`);
  } else {
    const matchColumn = profileByEmail ? "email" : "auth_user_id";
    const matchValue = profileByEmail ? user.email : user.authUserId;
    const { error } = await supabase
      .from("user_profiles")
      .update(target)
      .eq(matchColumn, matchValue);

    if (error) {
      throw error;
    }

    console.log(`${user.email}: profile ${profileByEmail ? "exists" : "linked by auth user"}`);
    console.log(`${user.email}: profile updated`);
  }

  if (profile?.role === user.role) {
    console.log(`${user.email}: role already correct`);
  } else {
    console.log(`${user.email}: role assigned`);
  }

  console.log(`${user.email}: is_active true`);
}

async function assertUserProfilesTable(supabase) {
  const { error } = await supabase
    .from("user_profiles")
    .select("email")
    .limit(1);

  if (error) {
    throw new Error(
      "user_profiles table is not available. Apply supabase/migrations/030_user_profiles.sql before seeding users.",
    );
  }
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const temporaryPassword = process.env.INITIAL_USER_TEMP_PASSWORD || "123456";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await assertUserProfilesTable(supabase);

  for (const user of USERS) {
    await ensureUser(supabase, user, temporaryPassword);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
