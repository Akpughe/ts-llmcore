# Codecov Setup Guide

This guide explains how to configure Codecov for the LLM Router project to avoid rate limiting issues and ensure reliable coverage reporting.

## Overview

The project uses Codecov to track test coverage and generate coverage reports. To avoid rate limiting issues with anonymous uploads, we use a repository upload token.

## Setup Instructions

### 1. Codecov Account Setup

1. Go to [codecov.io](https://codecov.io) and sign in with your GitHub account
2. Add the repository to Codecov
3. Navigate to the repository settings on Codecov
4. Copy the **Repository Upload Token**

### 2. GitHub Repository Setup

1. Go to your GitHub repository settings
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Add a new repository secret:
   - **Name**: `CODECOV_TOKEN`
   - **Value**: The repository upload token from Codecov

### 3. Local Development Setup

For local testing of coverage uploads:

```bash
# Set the environment variable (replace with your actual token)
export CODECOV_TOKEN="your-codecov-token-here"

# Run tests with coverage
npm run test:ci

# Upload coverage manually
npm run coverage:upload
```

## Configuration Files

### codecov.yml

The `codecov.yml` file in the root directory configures:

- **Coverage thresholds**: Reasonable targets based on current coverage
- **File ignores**: Excludes test files and build artifacts
- **Comment behavior**: Customizes PR comments
- **Status checks**: Configures GitHub status checks

### CI Workflow

The GitHub Actions workflow (`.github/workflows/ci.yml`) includes:

- **Token-based uploads**: Uses `CODECOV_TOKEN` secret
- **Retry mechanism**: Automatically retries failed uploads
- **Verbose logging**: Provides detailed output for debugging

## Troubleshooting

### Rate Limiting Issues

**Symptoms**:

- Error: "Rate limit reached"
- Failed uploads in CI
- HTTP 429 responses

**Solutions**:

1. Ensure `CODECOV_TOKEN` is properly set in GitHub secrets
2. Use the retry script: `npm run coverage:upload`
3. Check Codecov service status at [status.codecov.io](https://status.codecov.io)

### Upload Failures

**Common Issues**:

1. **Missing Token**:

   ```bash
   # Check if token is set
   echo $CODECOV_TOKEN
   ```

2. **Network Issues**:

   ```bash
   # Test connectivity
   curl -f https://codecov.io/upload/v2
   ```

3. **Invalid Coverage File**:
   ```bash
   # Check if coverage file exists and has content
   ls -la coverage/lcov.info
   ```

### Manual Upload

If automated upload fails, you can upload manually:

```bash
# Install codecov CLI
npm install -g codecov

# Upload with token
codecov -f ./coverage/lcov.info -t $CODECOV_TOKEN

# Upload without token (may hit rate limits)
codecov -f ./coverage/lcov.info
```

## Scripts

### Coverage Upload Script

The `scripts/upload-coverage.sh` script provides:

- **Exponential backoff**: Intelligent retry delays
- **Token validation**: Checks for required environment variables
- **File validation**: Ensures coverage files exist and are valid
- **Detailed logging**: Colored output with status messages

### Usage

```bash
# Make script executable (if not already)
chmod +x scripts/upload-coverage.sh

# Run directly
./scripts/upload-coverage.sh

# Or via npm
npm run coverage:upload
```

## Best Practices

### For Maintainers

1. **Monitor Coverage Trends**: Check Codecov dashboard regularly
2. **Review Coverage Reports**: Examine PR coverage changes
3. **Update Thresholds**: Adjust targets as code quality improves
4. **Token Security**: Regularly rotate the Codecov token

### For Contributors

1. **Run Tests Locally**: Use `npm run test:coverage` before pushing
2. **Check Coverage Impact**: Ensure new code maintains coverage levels
3. **Fix Coverage Issues**: Address any coverage regressions
4. **Report Issues**: Create GitHub issues for persistent upload problems

## Configuration Reference

### Environment Variables

| Variable        | Description             | Required     |
| --------------- | ----------------------- | ------------ |
| `CODECOV_TOKEN` | Repository upload token | Yes (for CI) |
| `CODECOV_URL`   | Custom Codecov URL      | No           |
| `CODECOV_SLUG`  | Repository slug         | No           |

### CI Configuration

The CI workflow uploads coverage only for Node.js 18 to avoid duplicate uploads:

```yaml
- name: Upload coverage to Codecov
  if: matrix.node-version == 18
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    file: ./coverage/lcov.info
    fail_ci_if_error: false
    verbose: true
```

## Monitoring

### Coverage Badges

Add coverage badge to README.md:

```markdown
[![codecov](https://codecov.io/gh/your-username/llm-router/branch/main/graph/badge.svg?token=YOUR_TOKEN)](https://codecov.io/gh/your-username/llm-router)
```

### Status Checks

Codecov provides GitHub status checks for:

- Project coverage
- Patch coverage
- Coverage changes

Configure these in the Codecov repository settings.

## Support

For additional help:

- [Codecov Documentation](https://docs.codecov.io)
- [GitHub Actions Integration](https://docs.codecov.io/docs/github-actions)
- [Codecov Support](https://codecov.io/support)
