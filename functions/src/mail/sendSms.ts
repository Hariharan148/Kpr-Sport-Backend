import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { SNSClient, SNSClientConfig, PublishCommand } from "@aws-sdk/client-sns";
require('dotenv').config();

admin.initializeApp();

const snsConfig: SNSClientConfig = {
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEYS!,
    secretAccessKey: process.env.AWS_SECRET_KEYS!,
  },
};

export const checkAttendance = functions.pubsub
  .schedule('0 12 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      const studentSms = new Map();
      

      const sns = new SNSClient(snsConfig);

      const studentDocId: string[] = [];

      console.log('hell', today);

      const attendanceQuerySnapshot = await admin
        .firestore()
        .collection('attendance')
        .where('date', '==', today)
        .get();

      if (attendanceQuerySnapshot.docs.length <= 0) {
        return;
      }

      const attendanceDoc = attendanceQuerySnapshot.docs[0];
      console.log(attendanceDoc);

      const studentsQuerySnapshot = await attendanceDoc.ref
        .collection('students')
        .get();

      studentsQuerySnapshot.forEach((studentDoc) => {
        const isAbsent = studentDoc.data().attendanceStatus === false;
        if (isAbsent) {
          studentDocId.push(studentDoc.id);
        }
      });

      console.log(studentDocId);

      const studentsCollectionRef = admin.firestore().collection('students');

      if (studentDocId.length === 0) {
        return;
      }

      const matchingStudentsQuerySnapshot = await studentsCollectionRef
        .where('id', 'in', studentDocId)
        .get();
      console.log('students', matchingStudentsQuerySnapshot);
      matchingStudentsQuerySnapshot.forEach((studentDoc) => {
        const smsInfo = {
          name: studentDoc.data().name,
          phone: studentDoc.data().phone,
          parentPhone: studentDoc.data().parentPhone,
        };
        studentSms.set(studentDoc.id, smsInfo);
      });

      console.log('sms', studentSms);

      for (const studentDocId of studentSms.keys()) {
        const smsInfo = studentSms.get(studentDocId);
        console.log('in', studentDocId);

        if (smsInfo) {
          const studentName = smsInfo.name;
          const studentPhone = `+91${smsInfo.phone}`;
          const parentPhone = `+91${smsInfo.parentPhone}`;

          const numberList = [parentPhone, studentPhone];
          const message = `Dear ${studentName},\n\nYou missed our sports training session today. Regular attendance is important for our team's success. Please let us know if we can support you in attending future sessions.\n\nBest regards,\nKprSport`;

          const sendSms = async (phoneNumbers: string[], message: string): Promise<void> => {
            try {
              for (const phoneNumber of phoneNumbers) {
                // Send SMS using AWS SNS
                const params = {
                  Message: message,
                  PhoneNumber: phoneNumber,
                };
                const command = new PublishCommand(params);
                const snsResponse = await sns.send(command);
                console.log(snsResponse);

                console.log(`SMS sent to ${phoneNumber} successfully!`);
              }
            } catch (error) {
              console.error('Failed to send SMS:', error);
            }
          };

          await sendSms(numberList, message);
        }
      }
    } catch (err) {
      console.log(err);
    }
  })