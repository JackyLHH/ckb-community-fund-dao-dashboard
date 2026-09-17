import {
  databaseRequest,
  digestEmail,
  fetchForumTopics,
  sendEmail,
  siteUrl,
  stateForTopic,
  type DigestState,
  type ForumTopic,
  type Subscriber,
} from '../../lib/subscription-server';

interface DigestRun {
  id: string;
}

async function updateStates(topics: ForumTopic[]) {
  if (topics.length === 0) return;
  await databaseRequest<void>('proposal_digest_state', 'on_conflict=topic_id', {
    method: 'POST',
    body: topics.map(stateForTopic),
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let runId: string | undefined;
  try {
    const runs = await databaseRequest<DigestRun[]>('digest_runs', 'select=id', {
      method: 'POST',
      body: { status: 'running' },
      prefer: 'return=representation',
    });
    runId = runs[0]?.id;

    const [topics, previousStates] = await Promise.all([
      fetchForumTopics(),
      databaseRequest<DigestState[]>(
        'proposal_digest_state',
        'select=topic_id,slug,title,posts_count,like_count,last_posted_at',
      ),
    ]);

    const previousById = new Map(previousStates.map((state) => [state.topic_id, state]));
    if (previousStates.length === 0) {
      await updateStates(topics);
      if (runId) {
        await databaseRequest<void>('digest_runs', `id=eq.${runId}`, {
          method: 'PATCH',
          body: { status: 'seeded', completed_at: new Date().toISOString() },
        });
      }
      return Response.json({ ok: true, seeded: topics.length, sent: 0 });
    }

    const newTopics = topics.filter((topic) => !previousById.has(topic.id));
    const updatedTopics = topics.filter((topic) => {
      const previous = previousById.get(topic.id);
      if (!previous) return false;
      const currentLastPost = topic.last_posted_at ?? topic.bumped_at ?? topic.created_at;
      return topic.posts_count > previous.posts_count || currentLastPost > previous.last_posted_at;
    });
    const changedTopics = [...newTopics, ...updatedTopics];

    if (changedTopics.length === 0) {
      await updateStates(topics);
      if (runId) {
        await databaseRequest<void>('digest_runs', `id=eq.${runId}`, {
          method: 'PATCH',
          body: { status: 'no_changes', completed_at: new Date().toISOString() },
        });
      }
      return Response.json({ ok: true, sent: 0, changes: 0 });
    }

    const subscribers = await databaseRequest<Subscriber[]>(
      'email_subscribers',
      'select=id,email,locale,status,confirmation_token,unsubscribe_token&status=eq.confirmed',
    );
    let sent = 0;
    const failures: string[] = [];

    for (let offset = 0; offset < subscribers.length; offset += 10) {
      const chunk = subscribers.slice(offset, offset + 10);
      const results = await Promise.allSettled(chunk.map(async (subscriber) => {
        const unsubscribeUrl = `${siteUrl()}/api/unsubscribe?token=${subscriber.unsubscribe_token}`;
        await sendEmail({
          to: subscriber.email,
          ...digestEmail(subscriber.locale, newTopics, updatedTopics, unsubscribeUrl),
        });
        await databaseRequest<void>('email_subscribers', `id=eq.${subscriber.id}`, {
          method: 'PATCH',
          body: { last_sent_at: new Date().toISOString() },
        });
      }));
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') sent += 1;
        else failures.push(chunk[index].email);
      });
    }

    await updateStates(topics);
    if (runId) {
      await databaseRequest<void>('digest_runs', `id=eq.${runId}`, {
        method: 'PATCH',
        body: {
          status: failures.length ? 'partial' : 'completed',
          completed_at: new Date().toISOString(),
          new_proposals: newTopics.length,
          updated_proposals: updatedTopics.length,
          recipients: sent,
          error_message: failures.length ? `${failures.length} delivery failure(s)` : null,
        },
      });
    }

    return Response.json({
      ok: failures.length === 0,
      newProposals: newTopics.length,
      updatedProposals: updatedTopics.length,
      sent,
      failed: failures.length,
    }, { status: failures.length ? 207 : 200 });
  } catch (error) {
    console.error('Daily digest failed', error);
    if (runId) {
      await databaseRequest<void>('digest_runs', `id=eq.${runId}`, {
        method: 'PATCH',
        body: {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
        },
      }).catch(() => undefined);
    }
    return Response.json({ ok: false }, { status: 500 });
  }
}
