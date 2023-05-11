import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

interface ApplicationStackProps extends StackProps { vpc: ec2.Vpc }

export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const instanceType = this.node.tryGetContext('instance_type');
    const sshCidrRange = this.node.tryGetContext('ssh_cidr_range');
    const keyPairName = this.node.tryGetContext('key_pair_name');
    const bucketName = this.node.tryGetContext('s3_bucket_name');

    // Permissions
    const role = new iam.Role(this, 'ApplicationRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        s3BucketAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [ 's3:ListBucket' ],
              resources: [ `arn:aws:s3:::${bucketName}` ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [ 's3:*Object' ],
              resources: [ `arn:aws:s3:::${bucketName}/*` ]
            })
          ]
        })
      }
    });

    // UserData
    const userData = ec2.UserData.forLinux()
    userData.addCommands('echo "Hello, World!" > index.html && nohup python -m SimpleHTTPServer 80 &');

    // EC2 instance
    const instance = new ec2.Instance(this, 'ApplicationInstance', {
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      instanceType: new ec2.InstanceType(instanceType),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      keyName: keyPairName,
      role: role,
      userData: userData,
      userDataCausesReplacement: true
    });

    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'Global HTTP Access')
    instance.connections.allowFromAnyIpv4(ec2.Port.tcp(443), 'Global HTTPS Access')
    instance.connections.allowFrom(ec2.Peer.ipv4(sshCidrRange), ec2.Port.tcp(22), 'Restricted SSH Access')

    // Elastic IP
    const eip = new ec2.CfnEIP(this, 'ApplicationEIP', {
      domain: 'vpc',
      instanceId: instance.instanceId
    });

    // Outputs
    new CfnOutput(this, 'ApplicationURL', {
      value: `http://${eip.ref}`,
      description: 'URL of the application.'
    });

    new CfnOutput(this, 'ApplicationIP', {
      value: eip.ref,
      description: 'IP Address of the application instance.'
    });
  }
}
