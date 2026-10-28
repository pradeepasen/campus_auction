async function verify() {
  console.log("--- 1. Testing /login page content ---");
  const pageRes = await fetch("http://localhost:3000/login");
  const html = await pageRes.text();
  console.log("HTTP Status:", pageRes.status);
  console.log("Has 'Welcome Back':", html.includes("Welcome Back"));
  console.log("Has 'Sign in to your Campus Auction account to continue':", html.includes("Sign in to your Campus Auction account to continue"));
  console.log("Has 'Enter your username':", html.includes("Enter your username"));
  console.log("Has 'Enter your password':", html.includes("Enter your password"));
  console.log("Has 'Contact your campus administrator':", html.includes("Contact your campus administrator to get access"));
  console.log("Has 'One-Click Demo':", html.includes("One-Click Demo"));

  console.log("\n--- 2. Testing Empty Fields Validation ---");
  const emptyRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "", password: "" })
  });
  const emptyData = await emptyRes.json();
  console.log("Empty fields status:", emptyRes.status, "Error message:", emptyData.error);

  console.log("\n--- 3. Testing Sign In with Registered Account (aarav) ---");
  const aaravRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "aarav", password: "password123" })
  });
  const aaravData = await aaravRes.json();
  const rawCookieAarav = aaravRes.headers.get("set-cookie");
  const cookieAarav = rawCookieAarav ? rawCookieAarav.split(";")[0] : "";
  console.log("aarav login status:", aaravRes.status, "User:", aaravData.user?.username, "Cookie set:", !!cookieAarav);

  console.log("\n--- 4. Testing Sign In with Any Password on Existing Account (priya) ---");
  const priyaRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "priya", password: "custompassword456" })
  });
  const priyaData = await priyaRes.json();
  const rawCookiePriya = priyaRes.headers.get("set-cookie");
  const cookiePriya = rawCookiePriya ? rawCookiePriya.split(";")[0] : "";
  console.log("priya login status:", priyaRes.status, "User:", priyaData.user?.username, "Cookie set:", !!cookiePriya);

  console.log("\n--- 5. Testing Sign In with New Student Account (pradeepa) ---");
  const newRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "pradeepa", password: "mypassword" })
  });
  const newData = await newRes.json();
  const rawCookieNew = newRes.headers.get("set-cookie");
  const cookieNew = rawCookieNew ? rawCookieNew.split(";")[0] : "";
  console.log("pradeepa login status:", newRes.status, "User:", newData.user?.username, "Name:", newData.user?.name, "Cookie set:", !!cookieNew);

  console.log("\n--- 6. Testing Session Verification with Protected Route (/api/auth/me) ---");
  const meRes = await fetch("http://localhost:3000/api/auth/me", {
    headers: { "Cookie": cookieNew }
  });
  const meData = await meRes.json();
  console.log("Me endpoint status:", meRes.status, "Logged in as:", meData.user?.username, "Name:", meData.user?.name);

  console.log("\n--- 7. Testing Protected Action (/api/notifications) ---");
  const notifRes = await fetch("http://localhost:3000/api/notifications", {
    headers: { "Cookie": cookieNew }
  });
  const notifData = await notifRes.json();
  console.log("Notifications endpoint status:", notifRes.status, "Unread count:", notifData.unreadCount);
}

verify().catch(console.error);
