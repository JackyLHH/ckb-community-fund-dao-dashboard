import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  async rewrites() {
    return [
      {
        source: '/live/nervos/category',
        destination: 'https://talk.nervos.org/c/daos-funding/ckb-community-fund-dao/65.json',
      },
      {
        source: '/live/nervos/topic/:id',
        destination: 'https://talk.nervos.org/t/:id.json',
      },
      {
        source: '/live/ckb/dao-balance',
        destination: 'https://mainnet-api.explorer.nervos.org/api/v1/addresses/ckb1qyqnrg4jfx82g29l44q6d93jnrm5ytcp0d8sjfev2q',
      },
    ];
  },
};

export default nextConfig;
