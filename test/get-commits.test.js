import test from 'ava';
import proxyquire from 'proxyquire';
import {stub} from 'sinon';
import SemanticReleaseError from '@semantic-release/error';
import {
  gitRepo,
  gitCommits,
  gitCheckout,
  gitTagVersion,
  gitShallowClone,
  gitTags,
  gitLog,
  gitDetachedHead,
} from './helpers/git-utils';

test.beforeEach(t => {
  // Save the current working diretory
  t.context.cwd = process.cwd();
  // Stub the logger functions
  t.context.log = stub();
  t.context.error = stub();
  t.context.getCommits = proxyquire('../src/lib/get-commits', {
    './logger': {log: t.context.log, error: t.context.error},
  });
});

test.afterEach.always(t => {
  // Restore the current working directory
  process.chdir(t.context.cwd);
});

test.serial('Get all commits when there is no last release', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  const commits = await gitCommits(['First', 'Second']);

  // Retrieve the commits with the commits module
  const result = await t.context.getCommits({}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.falsy(result.lastRelease.gitHead);
  t.falsy(result.lastRelease.version);
});

test.serial('Get all commits with gitTags', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  let commits = await gitCommits(['First']);
  // Create the tag corresponding to version 1.0.0
  await gitTagVersion('v1.0.0');
  // Add new commits to the master branch
  commits = (await gitCommits(['Second'])).concat(commits);

  // Retrieve the commits with the commits module
  const result = await t.context.getCommits({}, 'master');
  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[0].gitTags, '(HEAD -> master)');
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  t.is(result.commits[1].gitTags, '(tag: v1.0.0)');
});

test.serial('Get all commits when there is no last release, including the ones not in the shallow clone', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  const repo = await gitRepo();
  // Add commits to the master branch
  const commits = await gitCommits(['First', 'Second']);
  // Create a shallow clone with only 1 commit
  await gitShallowClone(repo);

  // Verify the shallow clone contains only one commit
  t.is((await gitLog()).length, 1);

  // Retrieve the commits with the commits module
  const result = await t.context.getCommits({}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.falsy(result.lastRelease.gitHead);
  t.falsy(result.lastRelease.version);
});

test.serial('Get all commits since gitHead (from lastRelease)', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  const commits = await gitCommits(['First', 'Second', 'Third']);

  // Retrieve the commits with the commits module, since commit 'First'
  const result = await t.context.getCommits({gitHead: commits[commits.length - 1].hash}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead, commits[commits.length - 1].hash);
  t.falsy(result.lastRelease.version);
});

test.serial('Get all commits since gitHead (from lastRelease) on a detached head repo', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  const repo = await gitRepo();
  // Add commits to the master branch
  const commits = await gitCommits(['First', 'Second', 'Third']);
  // Create a detached head repo at commit 'feat: Second'
  await gitDetachedHead(repo, commits[1].hash);

  // Retrieve the commits with the commits module, since commit 'First'
  const result = await t.context.getCommits({gitHead: commits[commits.length - 1].hash}, 'master');

  // Verify the module retrieved only the commit 'feat: Second' (included in the detached and after 'fix: First')
  t.is(result.commits.length, 1);
  t.is(result.commits[0].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[0].message, commits[1].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead, commits[commits.length - 1].hash);
  t.falsy(result.lastRelease.version);
});

test.serial('Get all commits since gitHead (from tag) ', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  let commits = await gitCommits(['First']);
  // Create the tag corresponding to version 1.0.0
  await gitTagVersion('1.0.0');
  // Add new commits to the master branch
  commits = (await gitCommits(['Second', 'Third'])).concat(commits);

  // Retrieve the commits with the commits module, since commit 'First' (associated with tag v1.0.0)
  const result = await t.context.getCommits({version: '1.0.0'}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead.substring(0, 7), commits[commits.length - 1].hash);
  t.is(result.lastRelease.version, '1.0.0');
});

test.serial('Get all commits since gitHead (from tag) on a detached head repo', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  const repo = await gitRepo();
  // Add commits to the master branch
  let commits = await gitCommits(['First']);
  // Create the tag corresponding to version 1.0.0
  await gitTagVersion('1.0.0');
  // Add new commits to the master branch
  commits = (await gitCommits(['Second', 'Third'])).concat(commits);
  // Create a detached head repo at commit 'feat: Second'
  await gitDetachedHead(repo, commits[1].hash);

  // Retrieve the commits with the commits module, since commit 'First' (associated with tag 1.0.0)
  const result = await t.context.getCommits({version: '1.0.0'}, 'master');

  // Verify the module retrieved only the commit 'feat: Second' (included in the detached and after 'fix: First')
  t.is(result.commits.length, 1);
  t.is(result.commits[0].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[0].message, commits[1].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead.substring(0, 7), commits[commits.length - 1].hash);
  t.is(result.lastRelease.version, '1.0.0');
});

test.serial('Get all commits since gitHead (from tag formatted like v<version>) ', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  let commits = await gitCommits(['First']);
  // Create the tag corresponding to version 1.0.0
  await gitTagVersion('v1.0.0');
  // Add new commits to the master branch
  commits = (await gitCommits(['Second', 'Third'])).concat(commits);

  // Retrieve the commits with the commits module, since commit 'First' (associated with tag v1.0.0)
  const result = await t.context.getCommits({version: '1.0.0'}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead.substring(0, 7), commits[commits.length - 1].hash);
  t.is(result.lastRelease.version, '1.0.0');
});

test.serial('Get commits when last release gitHead is missing but a tag match the version', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  let commits = await gitCommits(['First']);
  // Create the tag corresponding to version 1.0.0
  await gitTagVersion('v1.0.0');
  // Add new commits to the master branch
  commits = (await gitCommits(['Second', 'Third'])).concat(commits);

  // Retrieve the commits with the commits module, since commit 'First' (associated with tag v1.0.0)
  const result = await t.context.getCommits({version: '1.0.0', gitHead: 'missing'}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead.substring(0, 7), commits[commits.length - 1].hash);
  t.is(result.lastRelease.version, '1.0.0');
});

test.serial('Get all commits since gitHead, when gitHead are mising from the shallow clone', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  const repo = await gitRepo();
  // Add commits to the master branch
  const commits = await gitCommits(['First', 'Second', 'Third']);
  // Create a shallow clone with only 1 commit and no tags
  await gitShallowClone(repo);

  // Retrieve the commits with the commits module, since commit 'First'
  const result = await t.context.getCommits({version: '1.0.0', gitHead: commits[commits.length - 1].hash}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead.substring(0, 7), commits[commits.length - 1].hash);
  t.is(result.lastRelease.version, '1.0.0');
});

test.serial('Get all commits since gitHead from tag, when tags are mising from the shallow clone', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  const repo = await gitRepo();
  // Add commits to the master branch
  let commits = await gitCommits(['First']);
  // Create the tag corresponding to version 1.0.0
  await gitTagVersion('v1.0.0');
  // Add new commits to the master branch
  commits = (await gitCommits(['Second', 'Third'])).concat(commits);
  // Create a shallow clone with only 1 commit and no tags
  await gitShallowClone(repo);

  // Verify the shallow clone does not contains any tags
  t.is((await gitTags()).length, 0);

  // Retrieve the commits with the commits module, since commit 'First' (associated with tag v1.0.0)
  const result = await t.context.getCommits({version: '1.0.0'}, 'master');

  // Verify the commits created and retrieved by the module are identical
  t.is(result.commits.length, 2);
  t.is(result.commits[0].hash.substring(0, 7), commits[0].hash);
  t.is(result.commits[0].message, commits[0].message);
  t.truthy(result.commits[0].committerDate);
  t.truthy(result.commits[0].author.name);
  t.truthy(result.commits[0].committer.name);
  t.is(result.commits[1].hash.substring(0, 7), commits[1].hash);
  t.is(result.commits[1].message, commits[1].message);
  t.truthy(result.commits[1].committerDate);
  t.truthy(result.commits[1].author.name);
  t.truthy(result.commits[1].committer.name);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead.substring(0, 7), commits[commits.length - 1].hash);
  t.is(result.lastRelease.version, '1.0.0');
});

test.serial('Return empty array if lastRelease.gitHead is the last commit', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  const commits = await gitCommits(['First', 'Second']);

  // Retrieve the commits with the commits module, since commit 'Second' (therefore none)
  const result = await t.context.getCommits({gitHead: commits[0].hash, version: '1.0.0'}, 'master');

  // Verify no commit is retrieved
  t.deepEqual(result.commits, []);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.is(result.lastRelease.gitHead.substring(0, 7), commits[0].hash);
  t.is(result.lastRelease.version, '1.0.0');
});

test.serial('Return empty array if there is no commits', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();

  // Retrieve the commits with the commits module
  const result = await t.context.getCommits({}, 'master');

  // Verify no commit is retrieved
  t.deepEqual(result.commits, []);
  // Verify the last release is returned and updated
  t.truthy(result.lastRelease);
  t.falsy(result.lastRelease.gitHead);
  t.falsy(result.lastRelease.version);
});

test.serial('Throws ENOGITHEAD error if the gitHead of the last release cannot be found', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  await gitCommits(['First', 'Second']);

  // Retrieve the commits with the commits module
  const error = await t.throws(t.context.getCommits({version: '1.0.0'}, 'master'));

  // Verify error code and type
  t.is(error.code, 'ENOGITHEAD');
  t.true(error instanceof SemanticReleaseError);
  // Verify the log function has been called with a message explaining the error
  t.regex(
    t.context.error.firstCall.args[0],
    /The commit the last release of this package was derived from cannot be determined from the release metadata nor from the repository tags/
  );
});

test.serial('Throws ENOTINHISTORY error if gitHead is not in history', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  await gitCommits(['First', 'Second']);

  // Retrieve the commits with the commits module
  const error = await t.throws(t.context.getCommits({gitHead: 'notinhistory'}, 'master'));

  // Verify error code and type
  t.is(error.code, 'ENOTINHISTORY');
  t.true(error instanceof SemanticReleaseError);
  // Verify the log function has been called with a message mentionning the branch
  t.regex(t.context.error.firstCall.args[0], /history of the "master" branch/);
  // Verify the log function has been called with a message mentionning the missing gitHead
  t.regex(t.context.error.firstCall.args[0], /restoring the commit "notinhistory"/);
});

test.serial('Throws ENOTINHISTORY error if gitHead is not in branch history but present in others', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  await gitCommits(['First', 'Second']);
  // Create the new branch 'other-branch' from master
  await gitCheckout('other-branch');
  // Add commits to the 'other-branch' branch
  const commitsBranch = await gitCommits(['Third', 'Fourth']);
  await gitCheckout('master', false);

  // Retrieve the commits with the commits module
  const error = await t.throws(t.context.getCommits({version: '1.0.1', gitHead: commitsBranch[0].hash}, 'master'));

  // Verify error code and type
  t.is(error.code, 'ENOTINHISTORY');
  t.true(error instanceof SemanticReleaseError);
  // Verify the log function has been called with a message mentionning the branch
  t.regex(t.context.error.firstCall.args[0], /history of the "master" branch/);
  // Verify the log function has been called with a message mentionning the missing gitHead
  t.regex(t.context.error.firstCall.args[0], new RegExp(`restoring the commit "${commitsBranch[0].hash}"`));
});

test.serial('Throws ENOTINHISTORY error if gitHead is not in detached head but present in other branch', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  const repo = await gitRepo();
  // Add commit to the master branch
  await gitCommits(['First']);
  // Create the new branch 'other-branch' from master
  await gitCheckout('other-branch');
  // Add commits to the 'other-branch' branch
  const commitsBranch = await gitCommits(['Second', 'Third']);
  await gitCheckout('master', false);
  // Add new commit to master branch
  const commitsMaster = await gitCommits(['Fourth']);
  // Create a detached head repo at commit 'Fourth'
  await gitDetachedHead(repo, commitsMaster[0].hash);

  // Retrieve the commits with the commits module, since commit 'Second'
  const error = await t.throws(t.context.getCommits({version: '1.0.1', gitHead: commitsBranch[0].hash}, 'master'));

  // Verify error code and type
  t.is(error.code, 'ENOTINHISTORY');
  t.true(error instanceof SemanticReleaseError);
  // Verify the log function has been called with a message mentionning the branch
  t.regex(t.context.error.firstCall.args[0], /history of the "master" branch/);
  // Verify the log function has been called with a message mentionning the missing gitHead
  t.regex(t.context.error.firstCall.args[0], new RegExp(`restoring the commit "${commitsBranch[0].hash}"`));
});

test.serial('Throws ENOTINHISTORY error when a tag is not in branch history but present in others', async t => {
  // Create a git repository, set the current working directory at the root of the repo
  await gitRepo();
  // Add commits to the master branch
  await gitCommits(['First', 'Second']);
  // Create the new branch 'other-branch' from master
  await gitCheckout('other-branch');
  // Add commits to the 'other-branch' branch
  await gitCommits(['Third']);
  // Create the tag corresponding to version 1.0.0
  const shaTag = await gitTagVersion('v1.0.0');
  await gitCheckout('master', false);
  // Add new commit to the master branch
  await gitCommits(['Forth']);

  // Retrieve the commits with the commits module
  const error = await t.throws(t.context.getCommits({version: '1.0.0'}, 'master'));
  // Verify error code and type
  t.is(error.code, 'ENOTINHISTORY');
  t.true(error instanceof SemanticReleaseError);
  // Verify the log function has been called with a message mentionning the branch
  t.regex(t.context.error.firstCall.args[0], /history of the "master" branch/);
  // Verify the log function has been called with a message mentionning the missing gitHead
  t.regex(t.context.error.firstCall.args[0], new RegExp(`restoring the commit "${shaTag}"`));
});
