import NextAuth from 'next-auth';
import {authConfig} from './auth.config';
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/lib/prisma";
import {compare} from "bcryptjs";

export const {auth, signIn, signOut, handlers} = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: {label: "Username", type: "text", placeholder: "openhealth"},
                password: {label: "Password", type: "password"}
            },
            authorize: async (credentials) => {
                const {username, password} = credentials;
                console.log('Auth attempt:', {username, password: password ? '***' : 'null'});
                
                if (!username || !password) {
                    console.log('Missing credentials');
                    return null;
                }

                const user = await prisma.user.findUnique({
                    select: {id: true, password: true},
                    where: {username: username.toString()}
                })
                
                console.log('User found:', user ? 'yes' : 'no');
                if (!user) return null;

                const isValid = await compare(password.toString(), user.password);
                console.log('Password valid:', isValid);
                
                if (!isValid) return null;

                return {id: user.id, username};
            }
        }),
    ],
});
