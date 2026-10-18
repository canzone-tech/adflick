'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';
import { apiRequest, errorMessage, storeTokens } from '../../lib/api';
type LoginResponse={accessToken:string;refreshToken:string;user:{displayName:string;email:string;roles:string[]}};
export default function LoginPage(){
 const router=useRouter();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [notice,setNotice]=useState('Use an active account configured in the ADFLICK API database.');const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice('Signing in…');try{const data=await apiRequest<LoginResponse>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});if(!data.accessToken||!data.refreshToken)throw new Error('The API response did not include session tokens.');storeTokens(data.accessToken,data.refreshToken);setNotice(`Signed in as ${data.user.displayName}.`);router.push('/health');}catch(err){setNotice(errorMessage(err));}finally{setBusy(false);}}
 return <main className="login-shell"><Link href="/" className="login-back">← ADFLICK PLAYOUT CMS</Link><section className="login-card"><div className="login-mark">A▶</div><span className="login-eyebrow">AJOOBA DIGITAL · SECURE ACCESS</span><h1>Operations sign in</h1><p>Sign in with an active ADFLICK account to load live fleet health and incidents.</p><form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></label><button disabled={busy}>{busy?'Signing in…':'Sign in securely →'}</button></form><div className="login-notice" role="status">{notice}</div><small>Session tokens are stored in browser local storage for this prototype. For production, prefer secure HttpOnly cookies and a CSRF strategy.</small></section></main>
}
