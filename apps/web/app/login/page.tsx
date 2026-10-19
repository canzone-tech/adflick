'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';
import { apiRequest, errorMessage } from '../../lib/api';
type LoginResponse={expiresIn:number;refreshExpiresAt:string;user:{displayName:string;email:string;roles:string[]}};
export default function LoginPage(){
 const router=useRouter();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [notice,setNotice]=useState('Use your locally provisioned organization administrator account. No default password is provided.');const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice('Signing in…');try{const data=await apiRequest<LoginResponse>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});setNotice(`Signed in as ${data.user.displayName}.`);router.push('/account');}catch(err){setNotice(errorMessage(err));}finally{setBusy(false);}}
 return <main className="login-shell"><Link href="/" className="login-back">← ADFLICK PLAYOUT CMS</Link><section className="login-card"><div className="login-mark">A▶</div><span className="login-eyebrow">AJOOBA DIGITAL · SECURE ACCESS</span><h1>Operations sign in</h1><p>Sign in with a provisioned ADFLICK organization account to access authorized operational screens.</p><form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></label><button disabled={busy}>{busy?'Signing in…':'Sign in securely →'}</button></form><div className="login-notice" role="status">{notice}</div><small>Session credentials are stored in Secure, HttpOnly cookies. Browser JavaScript cannot read the access or refresh tokens; state-changing browser requests are origin-checked by the API.</small></section></main>
}
