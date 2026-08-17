import { Stack, type StackProps, Duration } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface GithubOidcStackProps extends StackProps {
  /**
   * Value GitHub puts in the OIDC token's "sub" claim for this repo, e.g.
   * "VgsStudio@81604963/3d-vsoller@1337229930". GitHub embeds immutable
   * owner/repo IDs (format "owner@ownerId/repo@repoId") — if
   * AssumeRoleWithWebIdentity fails with AccessDenied, check a CloudTrail
   * AssumeRoleWithWebIdentity event's userIdentity.userName for the exact
   * value actually sent. Same pattern as the sibling portfolio project.
   */
  githubRepo: string;
  /** CDK bootstrap qualifier — "hnb659fds" unless bootstrapped with --qualifier */
  cdkQualifier?: string;
}

export class GithubOidcStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);

    const qualifier = props.cdkQualifier ?? "hnb659fds";

    // GitHub's OIDC provider already exists in this account (created for the
    // portfolio project) — import it instead of creating a duplicate.
    const providerArn = `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;

    const deployRole = new iam.Role(this, "GithubActionsDeployRole", {
      roleName: "github-actions-3d-vsoller-deploy",
      description: "Assumed by GitHub Actions (OIDC) to deploy 3d.vsoller.com.br via CDK",
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(providerArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
        StringLike: {
          "token.actions.githubusercontent.com:sub": `repo:${props.githubRepo}:ref:refs/heads/main`,
        },
      }),
    });

    // Standard CDK bootstrap roles — this is the whole permission set needed
    // to run `cdk deploy`: it just assumes these, which already carry the
    // actual CloudFormation/S3/asset-publishing permissions.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AssumeCdkBootstrapRoles",
        actions: ["sts:AssumeRole"],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-${qualifier}-deploy-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-${qualifier}-file-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-${qualifier}-image-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-${qualifier}-lookup-role-${this.account}-${this.region}`,
        ],
      }),
    );
  }
}
