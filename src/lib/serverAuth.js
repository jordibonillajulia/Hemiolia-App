import { admin, adminDb } from './firebaseAdmin';

/**
 * Helper to verify the Firebase ID token in API routes and check roles.
 * Supports Authorization header ("Bearer <token>") and query parameter ("?token=<token>").
 * 
 * @param {Request} request Next.js request object
 * @param {string[]} allowedRoles Array of allowed roles (e.g. ['admin', 'crm'])
 * @returns {Promise<{uid: string, email: string, role: string} | null>} User details if authorized, or null
 */
export async function verifySessionOrToken(request, allowedRoles = ['admin', 'crm']) {
  try {
    let token = null;

    // 1. Try to extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Try to extract token from URL query params (fallback for downloads/exports)
    if (!token && request.url) {
      const { searchParams } = new URL(request.url);
      token = searchParams.get('token');
    }

    if (!token) {
      console.warn("🔒 ServerAuth: No authorization token provided.");
      return null;
    }

    // 3. Verify ID Token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email } = decodedToken;

    // 4. Check for hardcoded admin/crm email bypass first (saves Firestore reads)
    const isAdminEmail = 
      email === 'info@hemiolia.cat' || 
      email === 'admin@hemiolia.cat' || 
      email === 'jordibonillajulia@gmail.com';
    const isCrmEmail = email === 'unaonadapetitona@gmail.com';

    let role = 'viewer';
    if (isAdminEmail) {
      role = 'admin';
    } else if (isCrmEmail) {
      role = 'crm';
    } else {
      // Fetch role from Firestore users collection
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        role = userDoc.data().role || 'viewer';
      }
    }

    // 5. Authorize based on allowedRoles
    const isAuthorized = 
      role === 'admin' || // Admins have master access to everything
      allowedRoles.includes(role);

    if (isAuthorized) {
      return { uid, email, role };
    }

    console.warn(`🔒 ServerAuth: User ${email} (role: ${role}) not authorized for this endpoint.`);
    return null;
  } catch (error) {
    console.error("🔒 ServerAuth: Token verification failed:", error.message);
    return null;
  }
}
