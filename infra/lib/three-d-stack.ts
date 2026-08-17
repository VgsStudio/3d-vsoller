import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";
import * as fs from "fs";

export interface ThreeDStackProps extends cdk.StackProps {
  siteDomain: string; // 3d.vsoller.com.br
  apiDomain: string; // api.3d.vsoller.com.br
  parentZoneName: string; // vsoller.com.br
  hostedZoneId: string;
  adminApiKey: string;
}

export class ThreeDStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ThreeDStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "ParentZone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.parentZoneName,
    });

    // ---------- Data ----------
    const table = new dynamodb.Table(this, "PrintsTable", {
      tableName: "vsoller-3d-prints",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // ---------- Media bucket (photos / STL / gcode) ----------
    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      bucketName: `vsoller-3d-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: [`https://${props.siteDomain}`, "http://localhost:5173"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // ---------- Site bucket (built frontend) ----------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `vsoller-3d-site-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ---------- Lambda (API) ----------
    const apiFn = new lambda.Function(this, "ApiFunction", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "app.handler.lambda_handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "..", "..", "backend")),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        MEDIA_BUCKET: mediaBucket.bucketName,
        ADMIN_API_KEY: props.adminApiKey,
      },
    });
    table.grantReadWriteData(apiFn);
    mediaBucket.grantPut(apiFn);
    mediaBucket.grantRead(apiFn);

    // ---------- Certificates (both live in this region since we deploy in us-east-1) ----------
    const siteCert = new acm.Certificate(this, "SiteCertificate", {
      domainName: props.siteDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    const apiCert = new acm.Certificate(this, "ApiCertificate", {
      domainName: props.apiDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // ---------- HTTP API with custom domain ----------
    const apiDomainName = new apigwv2.DomainName(this, "ApiDomainName", {
      domainName: props.apiDomain,
      certificate: apiCert,
    });

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      defaultDomainMapping: {
        domainName: apiDomainName,
      },
      corsPreflight: {
        allowOrigins: [`https://${props.siteDomain}`, "http://localhost:5173"],
        allowHeaders: ["Content-Type", "x-api-key"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
      },
    });

    const integration = new apigwv2Integrations.HttpLambdaIntegration("ApiIntegration", apiFn);

    httpApi.addRoutes({ path: "/prints", methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration });
    httpApi.addRoutes({
      path: "/prints/{id}",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PATCH, apigwv2.HttpMethod.DELETE],
      integration,
    });
    httpApi.addRoutes({ path: "/prints/{id}/upload-url", methods: [apigwv2.HttpMethod.POST], integration });

    new route53.ARecord(this, "ApiAliasRecord", {
      zone,
      recordName: props.apiDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          apiDomainName.regionalDomainName,
          apiDomainName.regionalHostedZoneId,
        ),
      ),
    });

    // ---------- CloudFront (site + media) ----------
    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      domainNames: [props.siteDomain],
      certificate: siteCert,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "media/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(mediaBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    const webDist = path.join(__dirname, "..", "..", "web", "dist");
    if (fs.existsSync(webDist)) {
      new s3deploy.BucketDeployment(this, "DeploySite", {
        sources: [s3deploy.Source.asset(webDist)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ["/*"],
        prune: true,
      });
    }

    new route53.ARecord(this, "SiteAliasRecord", {
      zone,
      recordName: props.siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });
    new route53.AaaaRecord(this, "SiteAliasRecordV6", {
      zone,
      recordName: props.siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // ---------- Outputs ----------
    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${props.siteDomain}` });
    new cdk.CfnOutput(this, "ApiUrl", { value: `https://${props.apiDomain}` });
    new cdk.CfnOutput(this, "SiteBucketName", { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
  }
}
