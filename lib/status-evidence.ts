import type { ProposalVoting } from '@/lib/proposals';

const verifiedAt = '2026-09-03T09:16:07.000Z';
const correctionVerifiedAt = '2026-09-09T00:00:00.000Z';
const latestCorrectionVerifiedAt = '2026-09-10T00:00:00.000Z';
const currentCorrectionVerifiedAt = '2026-09-11T00:00:00.000Z';

function closedVote(
  url: string,
  totalVotes: number,
  minimumVotes: number,
  yesPercent: number,
  passPercent = 51,
): ProposalVoting {
  const approved = totalVotes >= minimumVotes && yesPercent >= passPercent;
  return {
    url,
    status: approved ? 'approved' : 'rejected',
    totalVotes,
    minimumVotes,
    yesPercent,
    passPercent,
    closed: true,
    verifiedAt,
  };
}

// Metaforo currently exposes these figures in its rendered proposal pages rather
// than a stable, unauthenticated JSON endpoint. The snapshot is deliberately
// small, dated, and linked back to the public page so every override is auditable.
export const voteEvidenceByProposalId: Record<string, ProposalVoting> = {
  '6968': {
    url: 'https://dao.ckb.community/thread/vot-nervos-nation-community-grant-proposal-42128',
    status: 'approved',
    totalVotes: 77_476_088,
    yesPercent: 78.69,
    passPercent: 51,
    closed: true,
    verifiedAt: latestCorrectionVerifiedAt,
  },
  '6891': {
    url: 'https://dao.ckb.community/thread/vot-complete-onboarding-of-the-br-crypto-community-into-the-nervos-ecosystem-42298',
    status: 'rejected',
    totalVotes: 13_196_090,
    yesPercent: 6.01,
    passPercent: 51,
    closed: true,
    verifiedAt: correctionVerifiedAt,
  },
  '7065': {
    url: 'https://dao.ckb.community/thread/vot-huntingnft-project-grant-proposal-42982',
    status: 'approved',
    totalVotes: 132_561_787,
    yesPercent: 78.21,
    passPercent: 51,
    closed: true,
    verifiedAt: correctionVerifiedAt,
  },
  '9756': closedVote(
    'https://dao.ckb.community/thread/vot-ckb-integration-for-rosen-bridge-66568',
    515_967_370,
    82_070_709,
    64.11,
  ),
  '10015': closedVote(
    'https://dao.ckb.community/thread/vot-decentralized-privacy-order-book-appchain-based-on-ckb-l1-2026-phase-1-69184',
    52_297_308,
    45_483_260,
    100,
  ),
  '10613': {
    url: 'https://dao.ckb.community/thread/vot-vellum-reputation-extension-on-did-ckb-77380',
    status: 'approved',
    totalVotes: 242_742_014,
    minimumVotes: 20_651_607,
    yesPercent: 64.37,
    passPercent: 51,
    closed: true,
    verifiedAt: currentCorrectionVerifiedAt,
  },
  '10583': closedVote(
    'https://dao.ckb.community/thread/vot-pocket-node-for-ios-a-self-custody-ckb-light-client-for-apple-and-identity-signer-for-ccc-web-apps-76502',
    183_137_529,
    54_347_826,
    52.77,
  ),
  '10419': closedVote(
    'https://dao.ckb.community/thread/vot-vellum-reputation-extension-on-did-ckb-74299',
    131_327_209,
    22_298_201,
    40.29,
  ),
  '10414': closedVote(
    'https://dao.ckb.community/thread/vot-fiberlatch-access-open-source-access-control-for-fiber-payments-74170',
    52_824_840,
    10_314_770,
    100,
  ),
  '10364': closedVote(
    'https://dao.ckb.community/thread/vot-rypto-ckb-content-advocacy-campaign-74122',
    55_473_775,
    14_620_000,
    100,
  ),
  '10317': closedVote(
    'https://dao.ckb.community/thread/vot-fiber-desktop-v1-ground-up-rebuild-and-launch-fnn-desktop-app-72720',
    65_057_521,
    15_000_000,
    100,
  ),
  '9879': closedVote(
    'https://dao.ckb.community/thread/vot-mobile-ready-ckb-light-client-pocket-node-for-android-67494',
    87_273_842,
    23_523_261,
    98.85,
  ),
  '9845': closedVote(
    'https://dao.ckb.community/thread/vot-fiber-link-a-ckb-fiber-based-pay-layer-tipping-micropayments-for-communities-67302',
    116_798_755,
    28_639_618,
    98.29,
  ),
  '8973': {
    ...closedVote(
      'https://talk.nervos.org/t/dis-community-fund-dao-v1-1-web5-community-fund-dao-v1-1-web5-optimization-proposal/8973/70',
      456_625_981,
      185_000_000,
      75.23,
      67,
    ),
    noteZh: 'DAO 管理委员会剔除 71,247,257 重复反对票后重新计票：赞成 343,524,829 票、反对 113,101,152 票，最终通过。',
    noteEn: 'After the DAO committee removed 71,247,257 duplicated no-votes, the corrected tally was 343,524,829 yes and 113,101,152 no; the proposal passed.',
  },
  '8832': closedVote(
    'https://dao.ckb.community/thread/vot-ckboost-gamified-community-engagement-platform-proposal-61358',
    19_705_314,
    12_124_689,
    100,
  ),
  '8369': closedVote(
    'https://dao.ckb.community/thread/vot-ickb-dckb-rescuer-funding-proposal-non-coding-expenses-55444',
    9_691_674,
    2_020_200,
    100,
  ),
  '8249': closedVote(
    'https://dao.ckb.community/thread/vot-use-usd-amounts-for-dao-payouts-calculated-on-the-date-of-ckb-payment-53431',
    90_411_228,
    185_000_000,
    100,
    67,
  ),
  '8174': closedVote(
    'https://dao.ckb.community/thread/vot-rgbcat-cat-gamefi-sponsorship-proposal-rgbcat-cat-gamefi-53237',
    10_804_804,
    24_329_382,
    0.93,
  ),
  '8150': closedVote(
    'https://dao.ckb.community/thread/vot-palmyra-rwa-lending-on-nervos-53119',
    83_303_682,
    17_900_829,
    83.78,
  ),
  '7849': closedVote(
    'https://dao.ckb.community/thread/vot-10-ckb-if-the-price-fluctuates-by-more-than-10-a-recalculation-of-the-ckb-quantity-is-required-at-the-time-of-payment-51254',
    38_696_817,
    185_000_000,
    56.26,
    67,
  ),
  '7727': closedVote(
    'https://dao.ckb.community/thread/vot-telmo-talks-a-nervos-talk-show-50421',
    176_415_438,
    0,
    75.46,
  ),
  '7615': closedVote(
    'https://dao.ckb.community/thread/vot-omiga-inscription-protocol-sponsorship-proposal-omiga-ckb-48580',
    210_107_461,
    56_374_674,
    100,
  ),
  '7594': closedVote(
    'https://dao.ckb.community/thread/vot-build-and-distribute-efficient-network-nodes-48231',
    27_855_274,
    4_432_287,
    100,
  ),
  '7593': closedVote(
    'https://dao.ckb.community/thread/vot-spore-protocol-mainnet-launch-sponsorship-proposal-48305',
    93_984_160,
    1_522_092,
    100,
  ),
  '7579': closedVote(
    'https://dao.ckb.community/thread/vot-joygift-phase-1-sponsorship-proposal-joygift-48022',
    23_601_773,
    7_159_905,
    100,
  ),
  '7251': closedVote(
    'https://dao.ckb.community/thread/vot-meta-rule-change-implement-staged-payments-for-proposals-with-a-budget-exceeding-10-000-10000-44725',
    287_308_282,
    185_000_000,
    100,
    67,
  ),
  '7194': closedVote(
    'https://dao.ckb.community/thread/vot-ckb-community-dao-proposal-44767',
    32_443_219,
    11_538_459,
    64.11,
  ),
  '7136': closedVote(
    'https://dao.ckb.community/thread/vot-ama-on-r-cryptocurrency-subreddit-43572',
    28_135_354,
    325_008,
    100,
  ),
  '7120': closedVote(
    'https://dao.ckb.community/thread/vot-changing-how-votes-are-calculated-43287',
    202_743_184,
    185_000_000,
    100,
    67,
  ),
  '7069': closedVote(
    'https://dao.ckb.community/thread/vot-ban-incentivized-voting-in-dao-43212',
    447_240_250,
    185_000_000,
    100,
    67,
  ),
  '7004': closedVote(
    'https://dao.ckb.community/thread/vot-ckbfans-ckbdapps-com-ckbfans-community-grant-proposal-ckbdapps-com-44239',
    44_629_390,
    3_947_367,
    79.45,
  ),
};

export const invalidVotingProposalIds = new Set(['7943']);

export const completionEvidenceByProposalId: Record<string, { label: string; url: string }> = {
  '8832': {
    label: 'CKBoost product delivery report',
    url: 'https://talk.nervos.org/t/dis-ckboost-gamified-community-engagement-platform-proposal/8832/32',
  },
  '9879': {
    label: 'Pocket Node completion report',
    url: 'https://talk.nervos.org/t/dis-mobile-ready-ckb-light-client-pocket-node-for-android/9879/71',
  },
  '9845': {
    label: 'Fiber Link product delivery report',
    url: 'https://talk.nervos.org/t/dis-fiber-link-a-ckb-fiber-based-pay-layer-tipping-micropayments-for-communities/9845/35',
  },
  '7136': {
    label: 'AMA completion update',
    url: 'https://talk.nervos.org/t/dis-ama-on-r-cryptocurrency-subreddit/7136/12',
  },
  '7594': {
    label: 'DAO V1 delivery review',
    url: 'https://talk.nervos.org/t/my-reflection-on-ckb-community-dao-v1/8750',
  },
  '7593': {
    label: 'Spore mainnet launch update',
    url: 'https://talk.nervos.org/t/status-update-spore-protocol-mainnet-launch-sponsorship-proposal-spore-protocol/7696',
  },
  '7004': {
    label: 'DAO V1 delivery review',
    url: 'https://talk.nervos.org/t/my-reflection-on-ckb-community-dao-v1/8750',
  },
};
