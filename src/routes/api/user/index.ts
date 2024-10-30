import {
  FastifyPluginAsyncTypebox,
  Type
} from '@fastify/type-provider-typebox'
import { Auth } from '../../../schemas/auth.js'
import { UpdateCredentialsSchema } from '../../../schemas/users.js'

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.put(
    '/update-password',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 minute',
          errorResponseBuilder: function (_, context) {
            return {
              statusCode: 429,
              error: 'Too Many Requests',
              message: `You have reached the request limit. Please try again in ${Math.floor(context.ttl / 1000)} seconds.`,
              date: new Date().toISOString(),
              retryAfter: context.ttl
            }
          }
        }
      },
      schema: {
        body: UpdateCredentialsSchema,
        response: {
          200: Type.Object({
            message: Type.String()
          }),
          401: Type.Object({
            message: Type.String()
          })
        },
        tags: ['User']
      }
    },
    async function (request, reply) {
      const { newPassword, currentPassword } = request.body
      const username = request.session.user.username

      try {
        const user = await fastify.knex<Auth>('users')
          .select('username', 'password')
          .where({ username })
          .first()

        if (!user) {
          return reply.unauthorized()
        }

        if (newPassword === currentPassword) {
          reply.status(400)
          return { message: 'New password cannot be the same as the current password.' }
        }

        const hashedPassword = await fastify.hash(newPassword)
        await fastify.knex('users')
          .update({
            password: hashedPassword
          })
          .where({ username })

        return { message: 'Password updated successfully' }
      } catch (error) {
        reply.internalServerError('An error occurred while updating the password.')
      }
    }
  )
}

export default plugin
